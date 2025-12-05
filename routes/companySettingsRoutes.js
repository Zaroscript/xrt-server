import express from "express";
import { getPublicCompanySettings } from "../controllers/companySettingsController.js";

const router = express.Router();

// Public route for company settings (used in invoices)
router.get("/company-settings", getPublicCompanySettings);

export default router;

