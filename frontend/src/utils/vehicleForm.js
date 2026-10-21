// Shared by the vehicle detail page and the add-vehicle page.
const str = (v) => (v === null || v === undefined ? '' : String(v));
const toId = (v) => (v === '' ? null : Number.isNaN(Number(v)) ? v : Number(v));

export const EMPTY_FORM = {
  plate: '', chassisNo: '', year: '', mileageKm: '', teamNo: '', vehicleNo: '', sensors: '',
  hasExhaust: false, hasGps: false,
  cityId: '', departmentId: '', modelId: '', statusId: '', companyId: '', driverId: '',
};

// API vehicle -> form values (all strings, booleans for checkboxes)
export function toForm(v) {
  return {
    plate: str(v.plate),
    chassisNo: str(v.chassisNo),
    year: str(v.year),
    mileageKm: str(v.mileageKm),
    teamNo: str(v.teamNo),
    vehicleNo: str(v.vehicleNo),
    sensors: str(v.sensors),
    hasExhaust: Boolean(v.hasExhaust),
    hasGps: Boolean(v.hasGps),
    cityId: str(v.city?.id),
    departmentId: str(v.department?.id),
    modelId: str(v.model?.id),
    statusId: str(v.status?.id),
    companyId: str(v.company?.id),
    driverId: str(v.driver?.id),
  };
}

// Form values -> request body.
// Edit (PATCH): "" is sent so the server clears the field.
// Create (POST): empty optional fields are left out.
export function toBody(f, { create = false } = {}) {
  const body = {
    plate: f.plate,
    chassisNo: f.chassisNo,
    teamNo: f.teamNo,
    vehicleNo: f.vehicleNo,
    sensors: f.sensors,
    hasExhaust: f.hasExhaust,
    hasGps: f.hasGps,
    cityId: toId(f.cityId),
    departmentId: toId(f.departmentId),
    modelId: toId(f.modelId),
    statusId: toId(f.statusId),
    companyId: toId(f.companyId),
    driverId: toId(f.driverId),
  };
  if (f.year !== '') body.year = Number(f.year);
  if (f.mileageKm !== '') body.mileageKm = Number(f.mileageKm);
  if (create) {
    for (const key of ['chassisNo', 'teamNo', 'vehicleNo', 'sensors', 'companyId', 'driverId']) {
      if (body[key] === '' || body[key] === null) delete body[key];
    }
  }
  return body;
}
