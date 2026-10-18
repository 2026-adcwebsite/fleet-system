const { z } = require('zod');

const MAX_PAGE_SIZE = 200;

// Spread into a route's query schema: z.object({ ...pageQuery, search: z.string().optional() })
const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
};

// -> { skip, take } for Prisma findMany
const skipTake = ({ page, pageSize }) => ({ skip: (page - 1) * pageSize, take: pageSize });

// Standard list response shape
const pageResult = (items, total, { page, pageSize }) => ({
  items,
  total,
  page,
  pageSize,
  pages: Math.max(1, Math.ceil(total / pageSize)),
});

module.exports = { pageQuery, skipTake, pageResult, MAX_PAGE_SIZE };
