import pool from "../config/db.js";

export const getDashboardSummary = async (req, res) => {
  try {
    const fincas = await pool.query("SELECT COUNT(*) FROM farms");
    const lotes = await pool.query("SELECT COUNT(*) FROM lots");
    const evaluaciones = await pool.query("SELECT COUNT(*) FROM evaluations");
    const alertas = await pool.query(`
      SELECT COUNT(*) 
      FROM evaluations 
      WHERE nivel_riesgo IN ('Alto', 'Crítico')
    `);

    res.json({
      fincas: Number(fincas.rows[0].count),
      lotes: Number(lotes.rows[0].count),
      evaluaciones: Number(evaluaciones.rows[0].count),
      alertas: Number(alertas.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo resumen dashboard" });
  }
};