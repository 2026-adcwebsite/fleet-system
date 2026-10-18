// Smoke test for auth, users and permissions. Run with the server up:
//   $env:SMOKE_ADMIN_PASSWORD="your current admin password"
//   node scripts/smoke.js
require("dotenv").config();

const BASE = process.env.SMOKE_BASE || "http://localhost:4000";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const ADMIN_PASSWORD =
  process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

let passed = 0;
let failed = 0;

function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(
      `  FAIL ${name}${extra !== undefined ? "  -> " + JSON.stringify(extra) : ""}`,
    );
  }
}

// Tiny client that keeps its own cookie, like a browser tab.
function client() {
  let cookie = "";
  return async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [];
    for (const c of setCookie) {
      const pair = c.split(";")[0];
      cookie = pair.endsWith("=") ? "" : pair; // cleared cookie
    }
    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      /* no body */
    }
    return { status: res.status, body: json };
  };
}

async function main() {
  const admin = client();
  const user = client();
  const stamp = Date.now();
  const testEmail = `smoke-${stamp}@test.com`;
  const tempPass = "temporary-pass-1";
  const newPass = "a-new-password-123";

  console.log("Health");
  let r = await admin("GET", "/api/health");
  check("health is ok", r.status === 200 && r.body.db === "connected", r);

  console.log("Login");
  r = await admin("POST", "/api/auth/login", {
    email: ADMIN_EMAIL,
    password: "definitely-wrong",
  });
  check("wrong password -> 401", r.status === 401, r);
  r = await admin("POST", "/api/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  check("admin login -> 200", r.status === 200, r);
  if (r.status !== 200)
    throw new Error("Cannot log in as admin, check SMOKE_ADMIN_PASSWORD");
  if (r.body.user.mustChangePassword) {
    throw new Error(
      "Admin still has the temporary password. Change it first via POST /api/auth/change-password, then rerun.",
    );
  }
  const adminId = r.body.user.id;
  r = await admin("GET", "/api/auth/me");
  check(
    "me returns admin",
    r.status === 200 && r.body.user.role === "admin",
    r,
  );

  console.log("Permission matrix");
  r = await admin("GET", "/api/permissions");
  check(
    "matrix has 4 roles, 5 modules, 20 rows",
    r.body &&
      r.body.roles.length === 4 &&
      r.body.modules.length === 5 &&
      r.body.permissions.length === 20,
    r.body && {
      roles: r.body.roles?.length,
      modules: r.body.modules?.length,
      rows: r.body.permissions?.length,
    },
  );
  const { roles, modules } = r.body;
  const roleId = (n) => roles.find((x) => x.name === n).id;
  const modId = (n) => modules.find((x) => x.name === n).id;

  r = await admin(
    "PUT",
    `/api/permissions/${roleId("admin")}/${modId("system")}`,
    { canView: false },
  );
  check("admin cannot lose system access -> 400", r.status === 400, r);

  console.log("Users");
  r = await admin("GET", "/api/users/options");
  check(
    "options returns roles and departments",
    r.status === 200 &&
      r.body.roles.length === 4 &&
      r.body.departments.length >= 5,
    r,
  );
  const deptId = r.body.departments[0].id;

  r = await admin("POST", "/api/users", {
    name: "Smoke",
    surname: "Test",
    email: testEmail,
    roleId: roleId("standard"),
    departmentId: deptId,
    password: tempPass,
  });
  check("create user -> 201", r.status === 201, r);
  const testId = r.body && r.body.user && r.body.user.id;
  r = await admin("POST", "/api/users", {
    name: "Smoke",
    surname: "Test",
    email: testEmail,
    roleId: roleId("standard"),
    password: tempPass,
  });
  check("duplicate email -> 409", r.status === 409, r);

  console.log("Forced password change");
  r = await user("POST", "/api/auth/login", {
    email: testEmail,
    password: tempPass,
  });
  check(
    "test user login -> 200, mustChangePassword",
    r.status === 200 && r.body.user.mustChangePassword === true,
    r,
  );
  r = await user("GET", "/api/_test/fleet");
  check(
    "guarded route blocked until password changed",
    r.status === 403 && r.body.code === "MUST_CHANGE_PASSWORD",
    r,
  );
  r = await user("POST", "/api/auth/change-password", {
    currentPassword: tempPass,
    newPassword: "short",
  });
  check("short new password -> 400", r.status === 400, r);
  r = await user("POST", "/api/auth/change-password", {
    currentPassword: "wrong-current-pw",
    newPassword: newPass,
  });
  check("wrong current password -> 401", r.status === 401, r);
  r = await user("POST", "/api/auth/change-password", {
    currentPassword: tempPass,
    newPassword: newPass,
  });
  check("change password -> 200", r.status === 200, r);

  console.log("Permissions in action");
  r = await user("GET", "/api/_test/fleet");
  check("standard user can view fleet -> 200", r.status === 200, r);
  r = await user("GET", "/api/users");
  check("standard user cannot list users -> 403", r.status === 403, r);
  r = await user("GET", "/api/permissions");
  check("standard user cannot read matrix -> 403", r.status === 403, r);

  r = await admin(
    "PUT",
    `/api/permissions/${roleId("standard")}/${modId("fleet")}`,
    { canView: false },
  );
  check("admin turns off fleet view for standard -> 200", r.status === 200, r);
  r = await user("GET", "/api/_test/fleet");
  check("standard user now blocked -> 403", r.status === 403, r);
  r = await admin(
    "PUT",
    `/api/permissions/${roleId("standard")}/${modId("fleet")}`,
    { canView: true },
  );
  check("admin restores fleet view -> 200", r.status === 200, r);
  r = await user("GET", "/api/_test/fleet");
  check("standard user can view fleet again", r.status === 200, r);

  console.log("Reference data");
  const anon = client();
  r = await anon("GET", "/api/cities");
  check("not logged in -> 401", r.status === 401, r);
  r = await admin("GET", "/api/departments");
  check(
    "departments seeded (5+)",
    r.status === 200 && r.body.items.length >= 5,
    r,
  );
  r = await user("GET", "/api/fuel-types");
  check(
    "standard user can read lists",
    r.status === 200 && r.body.items.length >= 2,
    r,
  );
  r = await user("POST", "/api/departments", { name: `Smoke-${stamp}` });
  check("standard user cannot add a department -> 403", r.status === 403, r);
  r = await admin("POST", "/api/cities", { name: "   " });
  check(
    "blank name -> 400 with details",
    r.status === 400 && Array.isArray(r.body.details),
    r,
  );
  r = await admin("POST", "/api/cities", { name: `SmokeCity-${stamp}` });
  check("admin creates city -> 201", r.status === 201, r);
  const cityId = r.body && r.body.item && r.body.item.id;
  r = await admin("POST", "/api/cities", { name: `SmokeCity-${stamp}` });
  check("duplicate city -> 409", r.status === 409, r);
  r = await user("POST", "/api/cities", { name: `SmokeCity2-${stamp}` });
  check(
    "standard user can add a city (fleet create) -> 201",
    r.status === 201,
    r,
  );
  const city2Id = r.body && r.body.item && r.body.item.id;
  r = await user("DELETE", `/api/cities/${city2Id}`);
  check(
    "standard user cannot delete (no fleet delete) -> 403",
    r.status === 403,
    r,
  );
  r = await admin("PATCH", `/api/cities/${cityId}`, {
    name: `SmokeRenamed-${stamp}`,
  });
  check(
    "rename city -> 200",
    r.status === 200 && r.body.item.name === `SmokeRenamed-${stamp}`,
    r,
  );
  r = await admin("GET", `/api/cities?search=smokerenamed-${stamp}`);
  check(
    "search finds it (case-insensitive)",
    r.status === 200 && r.body.items.length === 1,
    r,
  );
  r = await admin("POST", "/api/vehicle-models", {
    make: "SmokeMake",
    model: `M-${stamp}`,
  });
  check("create vehicle model -> 201", r.status === 201, r);
  const modelId = r.body && r.body.item && r.body.item.id;
  r = await admin("DELETE", `/api/vehicle-models/${modelId}`);
  check("delete vehicle model -> 200", r.status === 200, r);
  r = await admin("DELETE", `/api/cities/${cityId}`);
  check("delete city -> 200", r.status === 200, r);
  r = await admin("DELETE", `/api/cities/${city2Id}`);
  check("admin deletes the second city -> 200", r.status === 200, r);
  r = await admin("GET", "/api/nothing-here");
  check("unknown route -> 404", r.status === 404, r);

  console.log("Vehicles");
  r = await admin("GET", "/api/departments");
  const [deptA, deptB] = r.body.items;
  r = await admin("GET", "/api/vehicle-statuses");
  const statusId = r.body.items[0].id;
  r = await admin("POST", "/api/cities", { name: `SmokeVCity-${stamp}` });
  const vCityId = r.body.item.id;
  r = await admin("POST", "/api/vehicle-models", {
    make: "SmokeMake",
    model: `V-${stamp}`,
  });
  const vModelId = r.body.item.id;
  const plate = `SM${String(stamp).slice(-6)}`;
  const base = {
    cityId: vCityId,
    departmentId: deptA.id,
    modelId: vModelId,
    statusId,
  };

  r = await admin("POST", "/api/vehicles", {
    ...base,
    plate: ` ${plate.toLowerCase()} `,
    chassisNo: ` ch${stamp} `,
  });
  check(
    "create vehicle -> 201, plate and chassis normalized",
    r.status === 201 &&
      r.body.vehicle.plate === plate &&
      r.body.vehicle.chassisNo === `CH${stamp}`,
    r,
  );
  const vehicleId = r.body.vehicle && r.body.vehicle.id;
  r = await admin("POST", "/api/vehicles", { ...base, plate });
  check("duplicate plate -> 409", r.status === 409, r);
  r = await admin("POST", "/api/vehicles", { plate: "X1" });
  check(
    "missing fields -> 400 with details",
    r.status === 400 && r.body.details.length >= 3,
    r,
  );
  r = await admin("POST", "/api/vehicles", {
    ...base,
    plate: `Z${stamp}`,
    cityId: 999999,
  });
  check("unknown city -> 400", r.status === 400, r);
  r = await admin("POST", "/api/vehicles", {
    ...base,
    plate: `Z${stamp}`,
    year: 1800,
  });
  check("bad year -> 400", r.status === 400, r);

  r = await admin("GET", `/api/vehicles?search=${plate.toLowerCase()}`);
  check(
    "search finds the vehicle (case-insensitive)",
    r.status === 200 && r.body.total === 1 && r.body.items[0].id === vehicleId,
    r,
  );
  r = await admin(
    "GET",
    `/api/vehicles?cityId=${vCityId}&page=1&pageSize=5&sort=year&order=desc`,
  );
  check(
    "filter + paging shape",
    r.status === 200 &&
      r.body.pageSize === 5 &&
      r.body.total === 1 &&
      "pages" in r.body,
    r,
  );
  r = await admin("GET", "/api/vehicles?pageSize=100000");
  check("page size capped -> 400", r.status === 400, r);
  r = await user("GET", "/api/vehicles");
  check("standard user can list vehicles", r.status === 200, r);

  r = await admin("PATCH", `/api/vehicles/${vehicleId}`, {
    mileageKm: 12345,
    hasGps: true,
  });
  check(
    "patch vehicle -> 200",
    r.status === 200 &&
      r.body.vehicle.mileageKm === 12345 &&
      r.body.vehicle.hasGps === true,
    r,
  );
  r = await admin("PATCH", `/api/vehicles/${vehicleId}`, {});
  check("empty patch -> 400", r.status === 400, r);

  r = await admin("POST", `/api/vehicles/${vehicleId}/insurances`, {
    startDate: "2025-01-01",
    endDate: "2025-12-31",
  });
  check("add insurance -> 201", r.status === 201, r);
  r = await admin("POST", `/api/vehicles/${vehicleId}/insurances`, {
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
  const insId = r.body && r.body.item && r.body.item.id;
  check("add newer insurance -> 201", r.status === 201, r);
  r = await admin("POST", `/api/vehicles/${vehicleId}/insurances`, {
    startDate: "2026-05-01",
    endDate: "2026-04-01",
  });
  check("insurance end before start -> 400", r.status === 400, r);
  r = await admin("POST", `/api/vehicles/${vehicleId}/insurances`, {
    startDate: "2026-02-31",
    endDate: "2026-12-31",
  });
  check("impossible date -> 400", r.status === 400, r);
  r = await admin("POST", `/api/vehicles/${vehicleId}/inspections`, {
    startDate: "2026-03-01",
    endDate: "2027-03-01",
  });
  check("add inspection -> 201", r.status === 201, r);

  r = await admin("GET", `/api/vehicles/${vehicleId}`);
  check(
    "detail shows both insurances, newest first",
    r.status === 200 &&
      r.body.vehicle.insurances.length === 2 &&
      r.body.vehicle.insurances[0].endDate === "2026-12-31",
    r,
  );
  r = await admin("GET", `/api/vehicles?search=${plate}`);
  check(
    "list shows latest insurance and inspection end",
    r.body.items[0].insuranceEnd === "2026-12-31" &&
      r.body.items[0].inspectionEnd === "2027-03-01",
    r.body.items && r.body.items[0],
  );
  r = await admin("PATCH", `/api/vehicles/${vehicleId}/insurances/${insId}`, {
    endDate: "2027-06-30",
  });
  check(
    "patch insurance -> 200",
    r.status === 200 && r.body.item.endDate === "2027-06-30",
    r,
  );
  r = await admin("PATCH", `/api/vehicles/${vehicleId}/insurances/${insId}`, {
    endDate: "2025-06-30",
  });
  check("patch insurance end before stored start -> 400", r.status === 400, r);
  r = await user("POST", `/api/vehicles/${vehicleId}/insurances`, {
    startDate: "2027-01-01",
    endDate: "2027-12-31",
  });
  check(
    "standard user can add insurance (fleet create) -> 201",
    r.status === 201,
    r,
  );

  console.log("Department scope");
  const mgr = client();
  const mgrEmail = `smoke-mgr-${stamp}@test.com`;
  r = await admin("POST", "/api/users", {
    name: "Smoke",
    surname: "Manager",
    email: mgrEmail,
    roleId: roleId("dept_manager"),
    departmentId: deptB.id,
    password: tempPass,
  });
  check("create manager in the other department -> 201", r.status === 201, r);
  const mgrId = r.body && r.body.user && r.body.user.id;
  await mgr("POST", "/api/auth/login", { email: mgrEmail, password: tempPass });
  await mgr("POST", "/api/auth/change-password", {
    currentPassword: tempPass,
    newPassword: newPass,
  });
  r = await mgr("GET", "/api/vehicles?pageSize=200");
  check(
    "manager list has no vehicle from another department",
    r.status === 200 && !r.body.items.some((v) => v.id === vehicleId),
    r.body && r.body.total,
  );
  r = await mgr("GET", `/api/vehicles?departmentId=${deptA.id}`);
  check(
    "manager cannot bypass scope with a department filter",
    r.status === 200 && r.body.total === 0,
    r.body && r.body.total,
  );
  r = await mgr("GET", `/api/vehicles/${vehicleId}`);
  check("manager detail of another department -> 404", r.status === 404, r);
  r = await mgr("GET", `/api/vehicles/${vehicleId}/insurances`);
  check(
    "manager insurance list of another department -> 404",
    r.status === 404,
    r,
  );
  r = await mgr("PATCH", `/api/vehicles/${vehicleId}`, { mileageKm: 1 });
  check("manager cannot edit (view-only role) -> 403", r.status === 403, r);

  r = await admin("PATCH", `/api/vehicles/${vehicleId}`, {
    departmentId: deptB.id,
  });
  check("move vehicle to the manager department -> 200", r.status === 200, r);
  r = await mgr("GET", `/api/vehicles/${vehicleId}`);
  check("manager now sees it", r.status === 200, r);
  r = await mgr("GET", "/api/vehicles?pageSize=200");
  check(
    "manager list now includes it",
    r.status === 200 && r.body.items.some((v) => v.id === vehicleId),
    r.body && r.body.total,
  );

  console.log("Vehicle cleanup");
  r = await admin("DELETE", `/api/vehicles/${vehicleId}/insurances/${insId}`);
  check("delete insurance -> 200", r.status === 200, r);
  r = await admin("DELETE", `/api/vehicles/${vehicleId}`);
  check("delete vehicle -> 200", r.status === 200, r);
  r = await admin("GET", `/api/vehicles/${vehicleId}`);
  check("deleted vehicle -> 404", r.status === 404, r);
  await admin("DELETE", `/api/vehicle-models/${vModelId}`);
  await admin("DELETE", `/api/cities/${vCityId}`);
  await admin("DELETE", `/api/users/${mgrId}`);

  console.log("Admin guards");
  r = await admin("PATCH", `/api/users/${adminId}`, {
    roleId: roleId("standard"),
  });
  check("cannot change own role -> 400", r.status === 400, r);
  r = await admin("PATCH", `/api/users/${adminId}`, { status: "inactive" });
  check("cannot change own status -> 400", r.status === 400, r);
  r = await admin("DELETE", `/api/users/${adminId}`);
  check("cannot delete self -> 400", r.status === 400, r);

  console.log("Deactivate, reset, delete");
  r = await admin("PATCH", `/api/users/${testId}`, { status: "inactive" });
  check("deactivate test user -> 200", r.status === 200, r);
  r = await user("GET", "/api/auth/me");
  check("their session is gone -> 401", r.status === 401, r);
  r = await user("POST", "/api/auth/login", {
    email: testEmail,
    password: newPass,
  });
  check("inactive user cannot log in -> 401", r.status === 401, r);

  r = await admin("PATCH", `/api/users/${testId}`, { status: "active" });
  check("reactivate -> 200", r.status === 200, r);
  r = await admin("POST", `/api/users/${testId}/reset-password`, {
    password: "reset-password-1",
  });
  check("reset password -> 200", r.status === 200, r);
  r = await user("POST", "/api/auth/login", {
    email: testEmail,
    password: "reset-password-1",
  });
  check(
    "login with reset password, must change again",
    r.status === 200 && r.body.user.mustChangePassword === true,
    r,
  );

  r = await admin("DELETE", `/api/users/${testId}`);
  check("delete test user -> 200", r.status === 200, r);
  r = await admin("GET", "/api/users");
  check(
    "deleted user not in list",
    r.status === 200 && !r.body.users.some((u) => u.id === testId),
    r,
  );
  r = await user("GET", "/api/auth/me");
  check("deleted user session gone -> 401", r.status === 401, r);

  console.log("Logout");
  r = await admin("POST", "/api/auth/logout");
  check("logout -> 200", r.status === 200, r);
  r = await admin("GET", "/api/auth/me");
  check("me after logout -> 401", r.status === 401, r);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("\nStopped:", err.message);
  process.exit(1);
});
