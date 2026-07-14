// Va montato DOPO resolveGroup (richiede req.membership già popolato).
module.exports = (req, res, next) => {
  if (req.membership?.role === 'ADMIN') {
    return next();
  }

  return res.status(403).json({ error: 'Permessi amministratore richiesti' });
};
