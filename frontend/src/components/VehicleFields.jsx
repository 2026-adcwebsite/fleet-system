import FormField from './FormField';
import SelectField from './SelectField';
import { t } from '../i18n';

// The vehicle form fields, shared by the detail page and the add page.
// form: values, set(key) / setSelect(key): change handlers, errors: { field: message }
// canCreateLists: user may add cities / drivers / models inline
export default function VehicleFields({ form, set, setSelect, errors = {}, readOnly = false, canCreateLists = false }) {
  const checkbox = 'flex items-center gap-2 text-sm';
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <FormField label={t('fleet.col.plate')} required maxLength={20} disabled={readOnly} value={form.plate} onChange={set('plate')} error={errors.plate} />
      <FormField label={t('vehicle.field.chassisNo')} disabled={readOnly} value={form.chassisNo} onChange={set('chassisNo')} error={errors.chassisNo} />
      <FormField label={t('vehicle.field.year')} type="number" disabled={readOnly} value={form.year} onChange={set('year')} error={errors.year} />
      <FormField label={t('fleet.col.mileage')} type="number" min="0" disabled={readOnly} value={form.mileageKm} onChange={set('mileageKm')} error={errors.mileageKm} />
      <FormField label={t('vehicle.field.teamNo')} disabled={readOnly} value={form.teamNo} onChange={set('teamNo')} error={errors.teamNo} />
      <FormField label={t('vehicle.field.vehicleNo')} disabled={readOnly} value={form.vehicleNo} onChange={set('vehicleNo')} error={errors.vehicleNo} />

      <SelectField label={t('fleet.col.city')} resource="cities" allowEmpty={false} creatable={canCreateLists && !readOnly} disabled={readOnly} value={form.cityId} onChange={setSelect('cityId')} error={errors.cityId} />
      <SelectField label={t('fleet.col.department')} resource="departments" allowEmpty={false} disabled={readOnly} value={form.departmentId} onChange={setSelect('departmentId')} error={errors.departmentId} />
      <SelectField label={t('fleet.col.model')} resource="vehicle-models" allowEmpty={false} creatable={canCreateLists && !readOnly} disabled={readOnly} value={form.modelId} onChange={setSelect('modelId')} error={errors.modelId} />
      <SelectField label={t('fleet.col.status')} resource="vehicle-statuses" allowEmpty={false} disabled={readOnly} value={form.statusId} onChange={setSelect('statusId')} error={errors.statusId} />
      <SelectField label={t('vehicle.field.company')} resource="companies" disabled={readOnly} value={form.companyId} onChange={setSelect('companyId')} error={errors.companyId} />
      <SelectField label={t('fleet.col.driver')} resource="drivers" creatable={canCreateLists && !readOnly} disabled={readOnly} value={form.driverId} onChange={setSelect('driverId')} error={errors.driverId} />

      <FormField label={t('vehicle.field.sensors')} disabled={readOnly} value={form.sensors} onChange={set('sensors')} error={errors.sensors} />
      <label className={checkbox}>
        <input type="checkbox" disabled={readOnly} checked={form.hasExhaust} onChange={set('hasExhaust')} />
        {t('vehicle.field.hasExhaust')}
      </label>
      <label className={checkbox}>
        <input type="checkbox" disabled={readOnly} checked={form.hasGps} onChange={set('hasGps')} />
        {t('vehicle.field.hasGps')}
      </label>
    </div>
  );
}
