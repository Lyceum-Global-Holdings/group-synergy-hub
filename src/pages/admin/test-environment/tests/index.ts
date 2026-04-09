import { TestSuite } from "./types";
import { authTests } from "./authTests";
import { warehouseTests } from "./warehouseTests";
import { procurementTests } from "./procurementTests";
import { sourcingTests } from "./sourcingTests";
import { financeTests } from "./financeTests";
import { constructionTests } from "./constructionTests";
import { productionTests } from "./productionTests";
import { salesTests } from "./salesTests";
import { managementTests } from "./managementTests";
import { socialMediaTests } from "./socialMediaTests";
import { edgeFunctionTests } from "./edgeFunctionTests";
import { rlsTests } from "./rlsTests";
import { adminTests } from "./adminTests";

export const testSuites: TestSuite[] = [
  { id: "auth", name: "Authentication", description: "Login, session, roles", icon: "🔐", tests: authTests },
  { id: "warehouse", name: "Warehouse", description: "Inventory & asset management", icon: "📦", tests: warehouseTests },
  { id: "procurement", name: "Procurement", description: "PR, PO, RFQ, BOM", icon: "🛒", tests: procurementTests },
  { id: "sourcing", name: "Sourcing", description: "Suppliers & contracts", icon: "🤝", tests: sourcingTests },
  { id: "finance", name: "Finance", description: "GL, AP/AR, bank, budgets", icon: "💰", tests: financeTests },
  { id: "construction", name: "Construction", description: "Projects, sites, safety", icon: "🏗️", tests: constructionTests },
  { id: "production", name: "Production", description: "Sectors, stages, WIP", icon: "🏭", tests: productionTests },
  { id: "sales", name: "Sales (TUH)", description: "Customers, CPO, finished goods", icon: "🏷️", tests: salesTests },
  { id: "management", name: "Management", description: "Dashboards, approvals, audit", icon: "📊", tests: managementTests },
  { id: "social-media", name: "Social Media", description: "Accounts, NDA, activity", icon: "📱", tests: socialMediaTests },
  { id: "admin", name: "Administration", description: "Companies, roles, modules", icon: "⚙️", tests: adminTests },
  { id: "edge-functions", name: "Edge Functions", description: "Function connectivity", icon: "⚡", tests: edgeFunctionTests },
  { id: "rls", name: "RLS & Security", description: "Row-level security policies", icon: "🛡️", tests: rlsTests },
];
