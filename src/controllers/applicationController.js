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

const asegurarTablasInventario = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_batches (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      inventory_product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
      codigo_lote VARCHAR(100),
      proveedor VARCHAR(150),
      cantidad_inicial NUMERIC NOT NULL DEFAULT 0,
      cantidad_disponible NUMERIC NOT NULL DEFAULT 0,
      unidad VARCHAR(30) DEFAULT 'L',
      costo_unitario NUMERIC,
      fecha_compra DATE,
      fecha_vencimiento DATE,
      estado VARCHAR(30) DEFAULT 'Activo',
      observaciones TEXT,
      creado_en TIMESTAMP DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      inventory_product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
      inventory_batch_id INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
      application_id INTEGER,
      tipo VARCHAR(30) NOT NULL,
      cantidad NUMERIC NOT NULL DEFAULT 0,
      unidad VARCHAR(30),
      existencia_anterior NUMERIC,
      existencia_nueva NUMERIC,
      descripcion TEXT,
      creado_en TIMESTAMP DEFAULT NOW()
    )
  `);
};

const consumirInventarioFEFO = async ({
  client,
  companyId,
  inventoryProductId,
  applicationId,
  cantidadUsada,
  unidad,
}) => {
  let pendiente = Number(cantidadUsada);

  const batches = await client.query(
    `
    SELECT *
    FROM inventory_batches
    WHERE company_id = $1
    AND inventory_product_id = $2
    AND estado = 'Activo'
    AND cantidad_disponible > 0
    ORDER BY fecha_vencimiento ASC NULLS LAST, id ASC
    FOR UPDATE
    `,
    [companyId, inventoryProductId]
  );

  const totalDisponible = batches.rows.reduce(
    (total, batch) => total + Number(batch.cantidad_disponible || 0),
    0
  );

  if (totalDisponible < pendiente) {
    throw new Error(
      `Inventario insuficiente por lotes. Disponible: ${totalDisponible} ${unidad || ""}`
    );
  }

  for (const batch of batches.rows) {
    if (pendiente <= 0) break;

    const disponible = Number(batch.cantidad_disponible || 0);
    const cantidadARestar = Math.min(disponible, pendiente);
    const nuevaCantidad = disponible - cantidadARestar;

    await client.query(
      `
      UPDATE inventory_batches
      SET cantidad_disponible = $1
      WHERE id = $2
      AND company_id = $3
      `,
      [nuevaCantidad, batch.id, companyId]
    );

    await client.query(
      `
      INSERT INTO inventory_movements (
        company_id,
        inventory_product_id,
        inventory_batch_id,
        application_id,
        tipo,
        cantidad,
        unidad,
        existencia_anterior,
        existencia_nueva,
        descripcion
      )
      VALUES ($1,$2,$3,$4,'Salida',$5,$6,$7,$8,$9)
      `,
      [
        companyId,
        inventoryProductId,
        batch.id,
        applicationId,
        cantidadARestar,
        unidad || batch.unidad || null,
        disponible,
        nuevaCantidad,
        "Salida por aplicación fitosanitaria FEFO",
      ]
    );

    pendiente -= cantidadARestar;
  }
};

const devolverInventarioAplicacion = async ({ client, companyId, applicationId }) => {
  const movimientos = await client.query(
    `
    SELECT *
    FROM inventory_movements
    WHERE company_id = $1
    AND application_id = $2
    AND tipo = 'Salida'
    ORDER BY id ASC
    FOR UPDATE
    `,
    [companyId, applicationId]
  );

  for (const mov of movimientos.rows) {
    if (!mov.inventory_batch_id) continue;

    await client.query(
      `
      UPDATE inventory_batches
      SET cantidad_disponible = cantidad_disponible + $1
      WHERE id = $2
      AND company_id = $3
      `,
      [Number(mov.cantidad || 0), mov.inventory_batch_id, companyId]
    );
  }

  await client.query(
    `
    DELETE FROM inventory_movements
    WHERE company_id = $1
    AND application_id = $2
    AND tipo = 'Salida'
    `,
    [companyId, applicationId]
  );
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasInventario(client);

    const companyId = obtenerCompanyId(req);

    if (!companyId) {
      await client.query("ROLLBACK");
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
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "Fecha, finca, lote y plaga objetivo son obligatorios",
      });
    }

    const fincaExiste = await client.query(
      `
      SELECT id
      FROM farms
      WHERE id = $1
      AND company_id = $2
      `,
      [Number(farm_id), companyId]
    );

    if (fincaExiste.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "La finca seleccionada no existe o no pertenece a esta empresa.",
      });
    }

    const loteExiste = await client.query(
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
      await client.query("ROLLBACK");
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
      const productoInventario = await client.query(
        `
        SELECT *
        FROM inventory_products
        WHERE id = $1
        AND company_id = $2
        AND estado = 'Activo'
        FOR UPDATE
        `,
        [inventoryProductIdFinal, companyId]
      );

      if (productoInventario.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          mensaje:
            "El producto seleccionado no existe, está inactivo o no pertenece a esta empresa.",
        });
      }

      const producto = productoInventario.rows[0];

      if (!cantidadUsadaNumero || cantidadUsadaNumero <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          mensaje: "Debe ingresar una cantidad usada mayor a cero.",
        });
      }

      productoFinal = producto.nombre;
      ingredienteFinal = producto.ingrediente_activo || ingredienteFinal;
      unidadInventarioFinal = producto.unidad || null;
    }

    if (!productoFinal) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "Debe seleccionar o escribir el producto aplicado.",
      });
    }

    const foto_url = obtenerFotoUrl(req);

    const result = await client.query(
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

    const aplicacion = result.rows[0];

    if (inventoryProductIdFinal && cantidadUsadaNumero) {
      await consumirInventarioFEFO({
        client,
        companyId,
        inventoryProductId: inventoryProductIdFinal,
        applicationId: aplicacion.id,
        cantidadUsada: cantidadUsadaNumero,
        unidad: unidadInventarioFinal,
      });
    }

    await client.query("COMMIT");

    res.json({
      mensaje: "Aplicación fitosanitaria creada correctamente",
      data: aplicacion,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("ERROR CREATE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error creando aplicación fitosanitaria",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const updateApplication = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasInventario(client);

    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const actual = await client.query(
      `
      SELECT *
      FROM applications
      WHERE id = $1
      AND company_id = $2
      FOR UPDATE
      `,
      [id, companyId]
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        mensaje: "Aplicación fitosanitaria no encontrada para esta empresa",
      });
    }

    const aplicacionActual = actual.rows[0];

    await devolverInventarioAplicacion({
      client,
      companyId,
      applicationId: id,
    });

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
      const productoInventario = await client.query(
        `
        SELECT *
        FROM inventory_products
        WHERE id = $1
        AND company_id = $2
        AND estado = 'Activo'
        FOR UPDATE
        `,
        [inventoryProductIdFinal, companyId]
      );

      if (productoInventario.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          mensaje:
            "El producto seleccionado no existe, está inactivo o no pertenece a esta empresa.",
        });
      }

      const producto = productoInventario.rows[0];

      if (!cantidadUsadaNumero || cantidadUsadaNumero <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          mensaje: "Debe ingresar una cantidad usada mayor a cero.",
        });
      }

      productoFinal = producto.nombre;
      ingredienteFinal = producto.ingrediente_activo || ingredienteFinal;
      unidadInventarioFinal = producto.unidad || null;
    }

    const nuevaFotoUrl = obtenerFotoUrl(req);
    const foto_url = nuevaFotoUrl || aplicacionActual.foto_url || null;

    const result = await client.query(
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

    const aplicacion = result.rows[0];

    if (inventoryProductIdFinal && cantidadUsadaNumero) {
      await consumirInventarioFEFO({
        client,
        companyId,
        inventoryProductId: inventoryProductIdFinal,
        applicationId: aplicacion.id,
        cantidadUsada: cantidadUsadaNumero,
        unidad: unidadInventarioFinal,
      });
    }

    await client.query("COMMIT");

    res.json({
      mensaje: "Aplicación fitosanitaria actualizada correctamente",
      data: aplicacion,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("ERROR UPDATE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error actualizando aplicación fitosanitaria",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const deleteApplication = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await asegurarTablasInventario(client);

    const companyId = obtenerCompanyId(req);
    const { id } = req.params;

    if (!companyId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "No se pudo identificar la empresa del usuario.",
      });
    }

    const actual = await client.query(
      `
      SELECT *
      FROM applications
      WHERE id = $1
      AND company_id = $2
      FOR UPDATE
      `,
      [id, companyId]
    );

    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        mensaje: "Aplicación fitosanitaria no encontrada para esta empresa",
      });
    }

    await devolverInventarioAplicacion({
      client,
      companyId,
      applicationId: id,
    });

    const result = await client.query(
      `
      DELETE FROM applications
      WHERE id = $1
      AND company_id = $2
      RETURNING *
      `,
      [id, companyId]
    );

    await client.query("COMMIT");

    res.json({
      mensaje: "Aplicación fitosanitaria eliminada correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("ERROR DELETE APPLICATION:", error);

    res.status(500).json({
      mensaje: "Error eliminando aplicación fitosanitaria",
      error: error.message,
    });
  } finally {
    client.release();
  }
};