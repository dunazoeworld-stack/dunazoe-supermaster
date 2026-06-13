// ================================================================
// DUNAZOE OS — SHARED ERROR HANDLER
// shared/middleware/errorHandler.js
// ================================================================

function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message || err);

  const status  = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    success: false,
    error:   message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
