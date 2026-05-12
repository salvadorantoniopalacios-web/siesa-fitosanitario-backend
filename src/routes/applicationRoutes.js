import express from "express";
import multer from "multer";
import path from "path";

import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../controllers/applicationController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
});

router.get("/", getApplications);

router.post(
  "/",
  upload.single("foto"),
  createApplication
);

router.put(
  "/:id",
  upload.single("foto"),
  updateApplication
);

router.delete("/:id", deleteApplication);

export default router;