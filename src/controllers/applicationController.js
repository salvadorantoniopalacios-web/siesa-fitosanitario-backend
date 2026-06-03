import pool from "../config/db.js";

const obtenerFotoUrl = (req) => {
  if (!req.file) return null;
  return `/uploads/${req.file.filename}`;
};

const obtenerCompanyId = (req) => {
  return req.usuario?.company_id || null;
};

const normalizarNumero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;

  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
};

export const getApplications = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const result = await pool.query(
      `
      SELECT 
        applications.*,
        farms.nombre AS finca,
        lots.codigo AS lote,
        inventory_products.nombre AS producto_inventario,
        inventory_products.existencia AS existencia_actual_producto
      FROM applications
      JOIN farms ON farms.id = applications.farm_id
      JOIN lots ON lots.id = applications.lot_id
      LEFT JOIN inventory_products 
        ON inventory_products.id = applications.inventory_product_id
      WHERE applications.company_id = $1
      ORDER BY applications.fecha DESC, applications.id DESC
      `,
      [companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET APPLICATIONS:", error);

    res.status(500).json({
      mensaje: "Error obteniendo aplicaciones fitosanitarias",
      error: error.message,
    });
  }
};

export const createApplication = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const {
      fecha,
      farm_id,
      lot_id,
      cultivo,
      plaga_objetivo,
      producto_aplicado,
      ingrediente_activo,
      dosis,
      unidad,
      volumen_agua,
      responsable,
      equipo_usado,
      observaciones,
      latitud,
      longitud,
      inventory_product_id,
      cantidad_usada,
    } = req.body;

    if (!fecha || !farm_id || !lot_id || !plaga_objetivo) {
      return res.status(400).json({
        mensaje: "Fecha, finca, lote y plaga objetivo son obligatorios",
      });
    }

    const fincaExiste = await pool.query(
      `
      SELECT id
      FROM farms
      WHERE id = $1
      AND company_id = $2
      `,
      [Number(farm_id), companyId]
    );

    if (fincaExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "La finca seleccionada no existe o no pertenece a esta empresa.",
      });
    }

    const loteExiste = await pool.query(
      `
      SELECT id
      FROM lots
      WHERE id = $1
      AND farm_id = $2
      AND company_id = $3
      `,
      [Number(lot_id), Number(farm_id), companyId]
    );

    if (loteExiste.rows.length === 0) {
      return res.status(400).json({
        mensaje: "El lote seleccionado no existe o no pertenece a esta empresa.",
      });
    }

    let productoFinal = producto_aplicado || null;
    let ingredienteFinal = ingrediente_activo || null;
    let unidadInventarioFinal = null;
    const cantidadUsadaNumero = normalizarNumero(cantidad_usada);
    const inventoryProductIdFinal = inventory_product_id
      ? Number(inventory_product_id)
      : null;

    if (inventoryProductIdFinal) {
      const productoInventario = await pool.query(
        `
        SELECT *
        FROM inventory_products
        WHERE id = $1
        AND company_id = $2
        AND estado = 'Activo'
        `,
        [inventoryProductIdFinal, companyId]
      );

      if (productoInventario.rows.length === 0) {
        return res.status(400).json({
          mensaje:
            "El producto seleccionado no existe, está inactivo o no pertenece a esta empresa.",
        });
      }

      const producto = productoInventario.rows[0];

      if (!cantidadUsadaNumero || cantidadUsadaNumero <= 0) {
        return res.status(400).json({
          mensaje: "Debe ingresar una cantidad usada mayor a cero.",
        });
      }

      if (Number(producto.existencia || 0) < cantidadUsadaNumero) {
        return res.status(400).json({
          mensaje: `Inventario insuficiente. Existencia actual: ${producto.existencia} ${producto.unidad}`,
        });
      }

      productoFinal = producto.nombre;
      ingredienteFinal = producto.ingrediente_activo || ingredienteFinal;
      unidadInventarioFinal = producto.unidad || null;
    }

    if (!productoFinal) {
      return res.status(400).json({
        mensaje: "Debe seleccionar o escribir el producto aplicado.",
      });
    }

    const foto_url = obtenerFotoUrl(req);

    const result = await pool.query(
      `
      INSERT INTO applications (
        fecha,
        farm_id,
        lot_id,
        cultivo,
        plaga_objetivo,
        producto_aplicado,
        ingrediente_activo,
        dosis,
        unidad,
        volumen_agua,
        responsable,
        equipo_usado,
        observaciones,
        foto_url,
        latitud,
        longitud,
        company_id,
        inventory_product_id,
        cantidad_usada,
        unidad_inventario
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        cultivo || null,
        plaga_objetivo,
        productoFinal,
        ingredienteFinal,
        dosis || null,
        unidad || null,
        volumen_agua || null,
        responsable || null,
        equipo_usado || null,
        observaciones || null,
        foto_url,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
        companyId,
        inventoryProductIdFinal,
        cantidadUsadaNumero,
        unidadInventarioFinal,
      ]
    );

    res.json({
      mensaje: "Aplicación fitosanitaria creada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR CREATE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error creando aplicación fitosanitaria",
      error: error.message,
    });
  }
};

export const updateApplication = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const actual = await pool.query(
      `
      SELECT *
      FROM applications
      WHERE id = $1
      AND company_id = $2
      `,
      [id, companyId]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Aplicación fitosanitaria no encontrada para esta empresa",
      });
    }

    const aplicacionActual = actual.rows[0];

    if (aplicacionActual.inventory_product_id && aplicacionActual.cantidad_usada) {
      await pool.query(
        `
        UPDATE inventory_products
        SET existencia = existencia + $1
        WHERE id = $2
        AND company_id = $3
        `,
        [
          Number(aplicacionActual.cantidad_usada),
          Number(aplicacionActual.inventory_product_id),
          companyId,
        ]
      );
    }

    const {
      fecha,
      farm_id,
      lot_id,
      cultivo,
      plaga_objetivo,
      producto_aplicado,
      ingrediente_activo,
      dosis,
      unidad,
      volumen_agua,
      responsable,
      equipo_usado,
      observaciones,
      latitud,
      longitud,
      inventory_product_id,
      cantidad_usada,
    } = req.body;

    let productoFinal = producto_aplicado || null;
    let ingredienteFinal = ingrediente_activo || null;
    let unidadInventarioFinal = null;
    const cantidadUsadaNumero = normalizarNumero(cantidad_usada);
    const inventoryProductIdFinal = inventory_product_id
      ? Number(inventory_product_id)
      : null;

    if (inventoryProductIdFinal) {
      const productoInventario = await pool.query(
        `
        SELECT *
        FROM inventory_products
        WHERE id = $1
        AND company_id = $2
        AND estado = 'Activo'
        `,
        [inventoryProductIdFinal, companyId]
      );

      if (productoInventario.rows.length === 0) {
        return res.status(400).json({
          mensaje:
            "El producto seleccionado no existe, está inactivo o no pertenece a esta empresa.",
        });
      }

      const producto = productoInventario.rows[0];

      productoFinal = producto.nombre;
      ingredienteFinal = producto.ingrediente_activo || ingredienteFinal;
      unidadInventarioFinal = producto.unidad || null;
    }

    const nuevaFotoUrl = obtenerFotoUrl(req);
    const foto_url = nuevaFotoUrl || aplicacionActual.foto_url || null;

    const result = await pool.query(
      `
      UPDATE applications
      SET
        fecha = $1,
        farm_id = $2,
        lot_id = $3,
        cultivo = $4,
        plaga_objetivo = $5,
        producto_aplicado = $6,
        ingrediente_activo = $7,
        dosis = $8,
        unidad = $9,
        volumen_agua = $10,
        responsable = $11,
        equipo_usado = $12,
        observaciones = $13,
        foto_url = $14,
        latitud = $15,
        longitud = $16,
        inventory_product_id = $17,
        cantidad_usada = $18,
        unidad_inventario = $19
      WHERE id = $20
      AND company_id = $21
      RETURNING *
      `,
      [
        fecha,
        Number(farm_id),
        Number(lot_id),
        cultivo || null,
        plaga_objetivo,
        productoFinal,
        ingredienteFinal,
        dosis || null,
        unidad || null,
        volumen_agua || null,
        responsable || null,
        equipo_usado || null,
        observaciones || null,
        foto_url,
        normalizarNumero(latitud),
        normalizarNumero(longitud),
        inventoryProductIdFinal,
        cantidadUsadaNumero,
        unidadInventarioFinal,
        id,
        companyId,
      ]
    );

    if (inventoryProductIdFinal && cantidadUsadaNumero) {
      await pool.query(
        `
        UPDATE inventory_products
        SET existencia = existencia - $1
        WHERE id = $2
        AND company_id = $3
        `,
        [cantidadUsadaNumero, inventoryProductIdFinal, companyId]
      );
    }

    res.json({
      mensaje: "Aplicación fitosanitaria actualizada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error actualizando aplicación fitosanitaria",
      error: error.message,
    });
  }
};

export const deleteApplication = async (req, res) => {
  try {
    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const actual = await pool.query(
      `
      SELECT *
      FROM applications
      WHERE id = $1
      AND company_id = $2
      `,
      [id, companyId]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Aplicación fitosanitaria no encontrada para esta empresa",
      });
    }

    const aplicacionActual = actual.rows[0];

    if (aplicacionActual.inventory_product_id && aplicacionActual.cantidad_usada) {
      await pool.query(
        `
        UPDATE inventory_products
        SET existencia = existencia + $1
        WHERE id = $2
        AND company_id = $3
        `,
        [
          Number(aplicacionActual.cantidad_usada),
          Number(aplicacionActual.inventory_product_id),
          companyId,
        ]
      );
    }

    const result = await pool.query(
      `
      DELETE FROM applications
      WHERE id = $1
      AND company_id = $2
      RETURNING *
      `,
      [id, companyId]
    );

    res.json({
      mensaje: "Aplicación fitosanitaria eliminada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR DELETE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error eliminando aplicación fitosanitaria",
      error: error.message,
    });
  }
};