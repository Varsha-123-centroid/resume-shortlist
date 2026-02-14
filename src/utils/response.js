exports.success = (res, message, data = null) => {
  res.json({
    status: true,
    message,
    data,
  });
};

exports.error = (res, message, code = 500) => {
  res.status(code).json({
    status: false,
    message,
  });
};
