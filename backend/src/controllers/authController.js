const config = require('../config');
const authService = require('../services/authService');
const { COOKIE } = require('../middlewares/auth');
 
const opcoesCookie = { httpOnly: true, sameSite: 'lax', secure: config.env === 'production', maxAge: 7 * 24 * 3600 * 1000 };
 
module.exports = {
  async login(req, res) {
    const { token, usuario } = await authService.login(req.body?.email, req.body?.senha);
    res.cookie(COOKIE, token, opcoesCookie).json({ usuario });
  },
  logout(_req, res) {
    res.clearCookie(COOKIE).json({ ok: true });
  },
  async me(req, res) {
    res.json(await authService.perfil(req.usuario.id));
  },
  async trocarSenha(req, res) {
    await authService.trocarSenha(req.usuario.id, req.body?.senha_atual, req.body?.nova_senha);
    res.json({ ok: true });
  },
};
