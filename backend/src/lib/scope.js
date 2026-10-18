// Which rows may this user see? Department managers see only their own department;
// every other role sees everything. Returns a Prisma `where` fragment.
//
//   prisma.vehicle.findMany({ where: { ...departmentScope(req.user), statusId } })
//
// Works for any model with a departmentId column (Vehicle, FuelRollout).
// For models without one, scope through the relation: { vehicle: departmentScope(user) }.
function departmentScope(user) {
  if (user.role.name !== "dept_manager") return {};
  // a manager with no department sees nothing rather than everything
  return { departmentId: user.departmentId ?? -1 };
}

module.exports = { departmentScope };
