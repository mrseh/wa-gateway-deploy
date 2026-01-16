class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  static error(res, message, statusCode = 500) {
    return res.status(statusCode).json({
      success: false,
      message,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}

module.exports = ApiResponse;
