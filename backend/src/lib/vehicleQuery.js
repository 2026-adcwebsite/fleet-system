// Vehicle filters shared by the list endpoint and the Excel export.
const { z } = require('zod');
const { positiveInt } = require('./schemas');
const { departmentScope } = require('./scope');

// spread into a route's query schema
const filterFields = {
  search: z.string().trim().optional(),
  cityId: positiveInt.optional(),
  departmentId: positiveInt.optional(),
  companyId: positiveInt.optional(),
  statusId: positiveInt.optional(),
  modelId: positiveInt.optional(),
  driverId: positiveInt.optional(),
};

// filters = the parsed query without paging/sorting; the department scope can't be bypassed
function vehicleWhere(user, { search, ...filters }) {
  const searchClause = search
    ? {
        OR: [
          { plate: { contains: search, mode: 'insensitive' } },
          { chassisNo: { contains: search, mode: 'insensitive' } },
          { vehicleNo: { contains: search, mode: 'insensitive' } },
          { teamNo: { contains: search, mode: 'insensitive' } },
          { driver: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }
    : {};
  return { AND: [departmentScope(user), filters, searchClause] };
}

module.exports = { filterFields, vehicleWhere };
