// 404 for any /api route nothing else handled.
function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// Last middleware. Express 5 sends errors from async routes here automatically.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // Prisma: unique constraint
  if (err.code === "P2002") {
    const fields =
      err.meta && err.meta.target
        ? [].concat(err.meta.target).join(", ")
        : "value";
    return res.status(409).json({ error: `Already exists: ${fields}` });
  }

  // Prisma: record not found on update/delete
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }

  // Prisma: foreign key (row still referenced, or referenced row missing)
  if (err.code === "P2003") {
    return res.status(409).json({ error: "Related record conflict" });
  }

  // errors we throw on purpose: throw Object.assign(new Error('msg'), { status: 400 })
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}

module.exports = { notFound, errorHandler };
