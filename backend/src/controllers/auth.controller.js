const authService = require('../services/auth.service');
const ApiResponse = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.success(res, result, 'Registration successful', 201);
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.success(res, result, 'Login successful');
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  return ApiResponse.success(res, null, 'Logout successful');
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  return ApiResponse.success(res, result, 'Token refreshed');
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  return ApiResponse.success(res, null, 'Email verified successfully');
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return ApiResponse.success(res, null, 'Password reset email sent');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  return ApiResponse.success(res, null, 'Password reset successful');
});

exports.getMe = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, req.user);
});
