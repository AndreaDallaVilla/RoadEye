const authService = require("../services/auth.service");

async function register(req, res, next) {
  try {
    const result = await authService.registerUser(req.body);
    res.status(result.richiedeVerificaEmail ? 202 : 201).json(result);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function requestEmailVerification(req, res, next) {
  try {
    const result = await authService.requestEmailVerification(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

function getCurrentUser(req, res, next) {
  try {
    const user = authService.getCurrentUser(req.user);
    res.status(200).json({ utente: user });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logoutUser(req.user, req.tokenAccesso);
    res.status(200).json({ message: "Logout effettuato con successo" });
  } catch (error) {
    next(error);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const result = await authService.requestPasswordReset(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function listPublicEntities(_req, res, next) {
  try {
    const enti = await authService.listPublicEntities();
    res.status(200).json({ enti });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentUser,
  listPublicEntities,
  login,
  logout,
  register,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
};
