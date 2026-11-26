// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import type { ComponentType, CSSProperties } from "react";
import {
  AwardIcon,
  BellIcon,
  BookOpenIcon,
  CalendarIcon,
  CalendarRangeIcon,
  ChartColumnIcon,
  ChartNoAxesCombinedIcon,
  CheckCheckIcon,
  CirclePlusIcon,
  CreditCardIcon,
  DatabaseIcon,
  FileSignatureIcon,
  FileTextIcon,
  HandshakeIcon,
  HouseIcon,
  LandmarkIcon,
  LifeBuoyIcon,
  MegaphoneIcon,
  NetworkIcon,
  PackageIcon,
  PaletteIcon,
  RefreshCwIcon,
  SatelliteDishIcon,
  ScaleIcon,
  ServerIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  TicketIcon,
  TreePalmIcon,
  TrophyIcon,
  UsersIcon,
  UtensilsIcon,
  VideoIcon,
  Volume2Icon,
  WalletIcon,
  WrenchIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { Capability } from "@constants/appMenu";
import { isPreviewEnabled, type PreviewFeature } from "@config/previewFeatures";
import { csmUrl, isacUrl, isCsmConfigured, isIsacConfigured } from "@config/apiConfig";

/**
 * Represents a searchable app or portal entry within One App.
 */
export interface DirectoryEntry {
  /** Unique directory identifier */
  id: string;
  /** Section heading title displayed on the result card */
  title: string;
  /** Action button label to navigate to the app */
  label: string;
  /** Contextual guidance hint or description */
  hint: string;
  /** In-app destination route */
  href: string;
  /** Section icon component */
  icon: ComponentType<{ size?: number; style?: CSSProperties }>;
  /** Category classification for related apps */
  category: string;
  /** Related topical tags */
  tags: string[];
  /** Whether the section has an interactive web portal */
  hasWebApp: boolean;
  /** Role capabilities required to see or access this app */
  requires?: Capability[];
  /** Preview feature flag required to display and access this app */
  previewFlag?: PreviewFeature;
  /** Whether destination opens in an external browser tab */
  isExternal?: boolean;
  /** Search keywords and synonyms */
  keywords: string[];
}

/**
 * Directory catalog containing all discoverable apps and portals in One App.
 */
export const DIRECTORY_CATALOG: readonly DirectoryEntry[] = [
  // --- People Ops & Workplace ---
  {
    id: "me-leave",
    title: "Leave Management",
    label: "Open Leave App",
    hint: "Apply for annual, sick, or casual leave and check balances",
    href: "/me/leave",
    icon: TreePalmIcon,
    category: "People Ops",
    tags: ["Leave", "Vacation", "Annual", "Sick", "Holiday", "PTO"],
    hasWebApp: true,
    keywords: [
      "leave",
      "leaves",
      "vacation",
      "annual",
      "casual",
      "sick",
      "time off",
      "holiday",
      "apply",
      "balance",
    ],
  },
  {
    id: "me-menu",
    title: "Cafeteria",
    label: "Open Cafeteria App",
    hint: "Check today's breakfast, lunch, and snack menu",
    href: "/me/menu",
    icon: UtensilsIcon,
    category: "Me",
    tags: ["Cafeteria", "Menu", "Food", "Meals", "Lunch"],
    hasWebApp: true,
    keywords: [
      "cafeteria",
      "menu",
      "lunch",
      "food",
      "breakfast",
      "meals",
      "order",
      "eat",
      "canteen",
      "snack",
    ],
  },
  {
    id: "me-subscriptions",
    title: "Subscriptions",
    label: "Open Subscriptions App",
    hint: "Manage lunch (LaaS) and PickMe commute subscriptions",
    href: "/me/subscriptions",
    icon: UtensilsIcon,
    category: "Me",
    tags: ["Subscriptions", "Lunch", "Commute", "PickMe", "LaaS"],
    hasWebApp: true,
    keywords: [
      "subscription",
      "subscriptions",
      "lunch subscription",
      "pickme",
      "commute",
      "laas",
    ],
  },
  {
    id: "po-active-employees",
    title: "Active Employees",
    label: "Open Employee Directory",
    hint: "Search global employee directory, office locations, and reporting lines",
    href: "/people-ops/reports/active-employees",
    icon: UsersIcon,
    category: "People Ops",
    requires: ["admin"],
    tags: ["Directory", "Staff", "Colleagues", "Team"],
    hasWebApp: true,
    keywords: [
      "directory",
      "staff",
      "employees",
      "active employees",
      "find employee",
      "roster",
      "colleagues",
    ],
  },
  {
    id: "po-par",
    title: "Performance Appraisals (PAR)",
    label: "Open PAR Reviews",
    hint: "Submit self-reviews, 360° feedback, and review team performance",
    href: "/me/performance",
    icon: AwardIcon,
    category: "People Ops",
    tags: ["PAR", "Performance", "Appraisal", "Review", "Feedback", "360"],
    hasWebApp: true,
    keywords: [
      "par",
      "performance",
      "appraisal",
      "review",
      "self review",
      "feedback",
      "360",
      "cycle",
      "evaluation",
    ],
  },
  {
    id: "po-promotions",
    title: "Promotions",
    label: "Open Promotions",
    hint: "Track career progression, job band eligibility, and promotion criteria",
    href: "/me/promotion",
    icon: ChartNoAxesCombinedIcon,
    category: "People Ops",
    tags: ["Promotions", "Career", "Job Band", "Growth"],
    hasWebApp: true,
    keywords: [
      "promotion",
      "promotions",
      "job band",
      "career",
      "band",
      "level",
      "ladder",
    ],
  },
  {
    id: "po-org-chart",
    title: "Org Chart",
    label: "View Org Chart",
    hint: "Visualize global reporting lines, department hierarchies, and leadership",
    href: "/people-ops/org-chart",
    icon: NetworkIcon,
    category: "People Ops",
    tags: ["Org Chart", "Hierarchy", "Reporting", "Structure", "People Ops", "HR"],
    hasWebApp: true,
    keywords: [
      "org chart",
      "hierarchy",
      "reporting",
      "manager",
      "reports",
      "structure",
      "tree",
      "people ops",
      "people operations",
      "hr",
      "human resources",
      "leadership",
      "policies",
      "onboarding",
    ],
  },
  {
    id: "po-my-team",
    title: "My Team",
    label: "Open My Team",
    hint: "View direct reporting lines, team member details, and subordinates",
    href: "/me/my-team",
    icon: UsersIcon,
    category: "People Ops",
    requires: ["lead"],
    tags: ["My Team", "Subordinates", "Reports", "Direct Reports"],
    hasWebApp: true,
    keywords: [
      "my team",
      "direct reports",
      "subordinates",
      "reports",
      "lead",
      "team member",
    ],
  },
  {
    id: "po-manage-subscriptions",
    title: "Manage Subscriptions",
    label: "Open Subscription Admin",
    hint: "Manage employee lunch (LaaS) and PickMe commute subscriptions",
    href: "/people-ops/subscriptions/manage",
    icon: TicketIcon,
    category: "People Ops",
    tags: ["Subscriptions", "Lunch", "Commute", "PickMe", "LaaS", "HR Admin"],
    hasWebApp: true,
    keywords: [
      "manage subscriptions",
      "subscription admin",
      "commute admin",
      "lunch admin",
      "pickme admin",
      "laas admin",
    ],
  },
  {
    id: "po-master-data",
    title: "Org Structure Master Data",
    label: "Open Org Structure",
    hint: "Manage company entity types, divisions, departments, and reporting hierarchy",
    href: "/people-ops/master-data/org-structure",
    icon: DatabaseIcon,
    category: "People Ops",
    requires: ["admin"],
    tags: ["Master Data", "Org Structure", "Departments", "Divisions", "HR Admin"],
    hasWebApp: true,
    keywords: [
      "master data",
      "org structure",
      "divisions",
      "departments",
      "people ops master data",
      "entity types",
      "hr master data",
    ],
  },
  {
    id: "po-banking",
    title: "Personal Banking Details",
    label: "Open Banking Details",
    hint: "Manage your direct deposit salary bank account and remittance details",
    href: "/me/banking",
    icon: WalletIcon,
    category: "Me",
    tags: ["Banking", "Accounts", "Salary", "Direct Deposit"],
    hasWebApp: true,
    keywords: [
      "banking",
      "bank account",
      "salary",
      "direct deposit",
      "remittance",
      "bacs",
      "personal banking",
      "bank details",
    ],
  },
  {
    id: "po-email-groups",
    title: "Email Groups",
    label: "Open Email Groups",
    hint: "Browse, join, and manage corporate mailing lists and distribution groups",
    href: "/me/email-groups",
    icon: UsersIcon,
    category: "Me",
    tags: ["Email", "Mailing Lists", "Distribution Lists", "Groups"],
    hasWebApp: true,
    keywords: [
      "email groups",
      "mailing list",
      "distribution list",
      "dl",
      "groups",
      "email",
    ],
  },
  {
    id: "po-email-signature",
    title: "Email Signature",
    label: "Generate Signature",
    hint: "Generate standardized, brand-compliant HTML email signatures",
    href: "/me/email-signature",
    icon: FileTextIcon,
    category: "Me",
    tags: ["Signature", "Branding", "Email", "HTML"],
    hasWebApp: true,
    keywords: [
      "email signature",
      "signature",
      "signature generator",
      "brand signature",
    ],
  },

  // --- Amplify (Social Advocacy & Engagement) ---
  {
    id: "amplify-celebrate",
    title: "Amplify Celebrate",
    label: "Open Celebrate",
    hint: "Celebrate milestones, work anniversaries, and company achievements",
    href: "/amplify/celebrate",
    icon: TrophyIcon,
    category: "Amplify",
    previewFlag: "amplify",
    tags: ["Amplify", "Celebrate", "Milestones", "Anniversary", "Social"],
    hasWebApp: true,
    keywords: [
      "amplify",
      "celebrate",
      "milestones",
      "achievements",
      "shoutout",
      "kudos",
      "anniversary",
      "win",
    ],
  },
  {
    id: "amplify-new-post",
    title: "Amplify New Post",
    label: "Create Amplify Post",
    hint: "Draft, schedule, and publish posts for social advocacy and LinkedIn sharing",
    href: "/amplify/new-post",
    icon: CirclePlusIcon,
    category: "Amplify",
    previewFlag: "amplify",
    tags: ["Amplify", "Post", "LinkedIn", "Social", "Share"],
    hasWebApp: true,
    keywords: [
      "amplify",
      "post",
      "create post",
      "new post",
      "linkedin",
      "social",
      "advocacy",
      "share",
    ],
  },
  {
    id: "amplify-current-posts",
    title: "Amplify Current Posts",
    label: "Open Amplify Posts",
    hint: "Browse and share live campaigns and approved social media posts",
    href: "/amplify/current-posts",
    icon: Volume2Icon,
    category: "Amplify",
    previewFlag: "amplify",
    tags: ["Amplify", "Campaigns", "LinkedIn", "Social"],
    hasWebApp: true,
    keywords: [
      "amplify",
      "posts",
      "current posts",
      "feed",
      "share",
      "campaigns",
      "linkedin",
    ],
  },
  {
    id: "amplify-analytics",
    title: "Amplify Analytics",
    label: "Open Amplify Analytics",
    hint: "Track company-wide social advocacy performance, participation, and reach",
    href: "/amplify/dashboards/glance",
    icon: ChartColumnIcon,
    category: "Amplify",
    previewFlag: "amplify",
    tags: ["Amplify", "Analytics", "Metrics", "Dashboard"],
    hasWebApp: true,
    keywords: [
      "amplify",
      "analytics",
      "dashboard",
      "glance",
      "scorecard",
      "operations",
      "participation",
      "metrics",
    ],
  },

  // --- Finance & Procurement ---
  {
    id: "fin-overview",
    title: "Finance Overview",
    label: "Open Finance Overview",
    hint: "Track corporate card spend trends and OPD medical claim allowance usage",
    href: "/finance/overview",
    icon: WalletIcon,
    category: "Finance",
    tags: ["Finance", "Overview", "Spend", "Budget", "Dashboard"],
    hasWebApp: true,
    keywords: [
      "finance",
      "finance overview",
      "spend",
      "allowance",
      "budget",
      "finance dashboard",
    ],
  },
  {
    id: "fin-cc",
    title: "Corporate Credit Cards",
    label: "Open Corporate Cards",
    hint: "Review monthly statement transactions, attach receipts, manage autofill rules, and submit",
    href: "/finance/cc/new",
    icon: CreditCardIcon,
    category: "Finance",
    tags: ["Credit Card", "Statements", "Receipts", "Transactions"],
    hasWebApp: true,
    keywords: [
      "credit card",
      "cc",
      "amex",
      "visa",
      "corporate card",
      "statement",
      "transactions",
      "receipts",
      "autofill rules",
      "autofill",
      "card admin",
      "upload statement",
      "bank statements",
    ],
  },
  {
    id: "fin-cc-approve",
    title: "Credit Card Approvals",
    label: "Approve Card Expenses",
    hint: "Review and approve corporate credit card transactions submitted by your team",
    href: "/finance/cc/approve",
    icon: CheckCheckIcon,
    category: "Finance",
    tags: ["Credit Card", "Approvals", "Expenses", "Reimbursements", "Team Cards"],
    hasWebApp: true,
    keywords: [
      "card approvals",
      "approve credit card",
      "approve cc",
      "card expenses approval",
      "corporate card review",
      "team expenses",
    ],
  },
  {
    id: "fin-expenses",
    title: "Expense & OPD Claims",
    label: "Open Expenses App",
    hint: "File travel, meal, OPD medical, and general expense reimbursements",
    href: "/me/claims",
    icon: WalletIcon,
    category: "Finance",
    tags: ["Expenses", "Claims", "Reimbursement", "Travel", "OPD"],
    hasWebApp: true,
    keywords: [
      "expenses",
      "claims",
      "expense claims",
      "reimbursement",
      "travel claim",
      "mileage",
      "opd claims",
      "opd",
      "medical",
      "medical claim",
      "doctor",
      "healthcare",
      "file claim",
      "new claim",
      "new expense",
      "submit claim",
    ],
  },
  {
    id: "fin-claim-approval",
    title: "Claim Approval",
    label: "Open Claim Approvals",
    hint: "Review, approve, or reject team expense and OPD reimbursement submissions",
    href: "/finance/claim-approval",
    icon: CheckCheckIcon,
    category: "Finance",
    tags: ["Approvals", "Claims", "Finance", "Reimbursement"],
    hasWebApp: true,
    keywords: [
      "claim approval",
      "approve claims",
      "expense approval",
      "opd approval",
      "pending approvals",
      "needs you",
      "decided claims",
    ],
  },
  {
    id: "fin-procurement",
    title: "Procurement",
    label: "Open Procurement",
    hint: "Raise purchase requests and track equipment, vendor, or hardware orders",
    href: "/finance/procurement/requests",
    icon: ShoppingCartIcon,
    category: "Finance",
    previewFlag: "procurement",
    tags: ["Procurement", "Purchase Request", "Hardware", "Vendor", "Equipment"],
    hasWebApp: true,
    keywords: [
      "procurement",
      "purchase request",
      "new purchase request",
      "new request",
      "raise po",
      "hardware",
      "laptop",
      "vendor",
      "purchase order",
      "po",
      "equipment",
      "order equipment",
    ],
  },
  {
    id: "fin-mis",
    title: "Finance MIS",
    label: "Open MIS Dashboard",
    hint: "View annual and quarterly recurring revenue (ARR/QRR) performance metrics and portfolio",
    href: "/finance/mis/arr-build",
    icon: ChartNoAxesCombinedIcon,
    category: "Finance",
    tags: ["MIS", "ARR", "QRR", "Revenue", "Metrics"],
    hasWebApp: true,
    keywords: [
      "mis",
      "arr",
      "qrr",
      "mrr",
      "recurring revenue",
      "finance mis",
      "financial reports",
      "mis portfolio",
      "arr analysis",
      "portfolio",
    ],
  },
  {
    id: "fin-banking-admin",
    title: "Banking Administration",
    label: "Open Banking Admin",
    hint: "Review employee bank account change requests, reports, and payroll operations",
    href: "/banking/admin",
    icon: LandmarkIcon,
    category: "Finance",
    tags: ["Banking", "Admin", "Change Requests", "Payroll", "Finance", "HR"],
    hasWebApp: true,
    keywords: [
      "banking admin",
      "bank admin",
      "change requests",
      "payroll banking",
      "bank operations",
      "finance banking",
      "remittance admin",
      "hr banking admin",
    ],
  },
  {
    id: "fin-master-data",
    title: "Finance Master Data",
    label: "Open Finance Master Data",
    hint: "Manage corporate entities, subsidiaries, tax codes, and GL account mappings",
    href: "/finance/master-data/subsidiaries",
    icon: DatabaseIcon,
    category: "Finance",
    tags: ["Master Data", "Finance", "Subsidiaries", "Departments", "Expense Types", "Credit Cards"],
    hasWebApp: true,
    keywords: [
      "finance master data",
      "subsidiaries",
      "departments",
      "expense types",
      "credit cards register",
      "tax codes",
      "legal entities",
      "gl codes",
    ],
  },

  // --- Sales & Revenue ---
  {
    id: "sales-quickquote",
    title: "QuickQuote (CadO2)",
    label: "Open QuickQuote",
    hint: "Configure CPQ quotes, discounts, legal entities, and approval workflows",
    href: "/sales/quickquote/quotes",
    icon: FileTextIcon,
    category: "Sales",
    previewFlag: "quickquote",
    tags: ["Quotes", "QuickQuote", "CadO2", "Discounts", "Salesforce"],
    hasWebApp: true,
    keywords: [
      "cado2",
      "quickquote",
      "quote",
      "cpq",
      "sales quote",
      "proposal",
      "discount approval",
    ],
  },
  {
    id: "sales-smart-search",
    title: "Ask Sales Library",
    label: "Open Ask Sales",
    hint: "Search Sales Pitstop collateral, competitive battle cards, and decks",
    href: "/sales/library",
    icon: BookOpenIcon,
    category: "Sales",
    tags: ["Sales Pitstop", "Ask Sales", "Battlecards", "Enablement", "Search"],
    hasWebApp: true,
    keywords: [
      "smart search",
      "ask sales",
      "pitstop",
      "battlecards",
      "sales library",
      "enablement",
      "competitors",
    ],
  },
  {
    id: "sales-echo-meetings",
    title: "Echo Calls",
    label: "Open Echo Calls",
    hint: "Access auto-recorded customer meeting transcripts, AI notes, and summaries",
    href: "/sales/meetings",
    icon: VideoIcon,
    category: "Sales",
    tags: ["Echo", "Calls", "Meetings", "Transcripts", "Recordings"],
    hasWebApp: true,
    keywords: [
      "echo",
      "calls",
      "meetings",
      "call recording",
      "transcript",
      "gong",
      "zoom",
      "sales call",
    ],
  },
  {
    id: "sales-echo-deals",
    title: "Opportunities",
    label: "Open Opportunities",
    hint: "Track MEDDPICC qualification progress and deal momentum across accounts",
    href: "/sales/deals",
    icon: HandshakeIcon,
    category: "Sales",
    tags: ["Deals", "Opportunities", "MEDDPICC", "Pipeline"],
    hasWebApp: true,
    keywords: [
      "echo",
      "deals",
      "opportunities",
      "meddpicc",
      "pipeline",
      "sales deals",
      "opportunity review",
    ],
  },

  // --- Marketing Operations ---
  {
    id: "mktg-utm",
    title: "UTM Generator",
    label: "Open UTM Builder",
    hint: "Generate standardized tracking links and query parameters for ad campaigns",
    href: "/marketing-ops/utilities/utm",
    icon: WrenchIcon,
    category: "Marketing Ops",
    tags: ["UTM", "Analytics", "Campaigns", "Tracking", "Marketing Ops"],
    hasWebApp: true,
    keywords: [
      "utm",
      "utm generator",
      "campaign url",
      "tracking links",
      "ad tracking",
      "url builder",
      "marketing ops",
      "marketing",
      "growth",
    ],
  },
  {
    id: "mktg-asset-name",
    title: "Asset Name Generator",
    label: "Open Asset Builder",
    hint: "Generate structured naming conventions for graphic designs and video assets",
    href: "/marketing-ops/utilities/asset-name",
    icon: WrenchIcon,
    category: "Marketing Ops",
    tags: ["Assets", "Design", "Naming", "Branding"],
    hasWebApp: true,
    keywords: [
      "asset name",
      "asset naming",
      "banner name",
      "graphic asset",
      "asset generator",
    ],
  },
  {
    id: "mktg-campaigns",
    title: "Ad Campaigns Analytics",
    label: "Open Campaign Analytics",
    hint: "Track digital ad spend, conversion rates, and paid acquisition ROI",
    href: "/marketing-ops/ad-campaigns/analytics",
    icon: ChartColumnIcon,
    category: "Marketing Ops",
    tags: ["Advertising", "PPC", "LinkedIn Ads", "Google Ads", "Analytics"],
    hasWebApp: true,
    keywords: [
      "ad campaigns",
      "ad analytics",
      "paid ads",
      "ppc",
      "roas",
      "campaign performance",
    ],
  },
  {
    id: "mktg-events",
    title: "Marketing Events",
    label: "Open Events App",
    hint: "Manage conferences, webinars, booth assignments, and lead imports",
    href: "/marketing-ops/events/mine",
    icon: CalendarIcon,
    category: "Marketing Ops",
    tags: ["Events", "Conferences", "Webinars", "Speakers"],
    hasWebApp: true,
    keywords: [
      "marketing events",
      "events",
      "conferences",
      "webinars",
      "summit",
      "booth",
    ],
  },
  {
    id: "mktg-calendar",
    title: "Marketing Calendar",
    label: "Open Calendar",
    hint: "View scheduled product launches, marketing emails, and campaign dates",
    href: "/marketing-ops/marketing-calendar",
    icon: CalendarIcon,
    category: "Marketing Ops",
    previewFlag: "marketingCalendar",
    tags: ["Calendar", "Schedule", "Launches", "Deadlines"],
    hasWebApp: true,
    keywords: [
      "marketing calendar",
      "campaign calendar",
      "content schedule",
      "launch calendar",
    ],
  },
  {
    id: "mktg-crm-upload",
    title: "CRM Upload",
    label: "Open CRM Upload",
    hint: "Ingest and validate lead and account records with deduplication pipelines",
    href: "/marketing-ops/crm-upload/pipelines",
    icon: RefreshCwIcon,
    category: "Marketing Ops",
    tags: ["CRM", "Upload", "Leads", "Accounts", "Pipelines", "Marketing Ops"],
    hasWebApp: true,
    keywords: [
      "crm upload",
      "crm",
      "lead ingest",
      "account upload",
      "pipelines",
      "review queue",
      "duplicates",
    ],
  },
  {
    id: "mktg-design-studio",
    title: "Design Studio",
    label: "Open Post Builder",
    hint: "Create brand-compliant LinkedIn banner and social media graphics",
    href: "/marketing-ops/design-studio/post-builder",
    icon: PaletteIcon,
    category: "Marketing Ops",
    tags: ["Design Studio", "Post Builder", "Graphics", "Banners", "LinkedIn", "Marketing Ops"],
    hasWebApp: true,
    keywords: [
      "design studio",
      "post builder",
      "banner builder",
      "graphics",
      "linkedin post",
      "social graphics",
      "branding",
    ],
  },
  {
    id: "mktg-email-workbench",
    title: "Email Workbench",
    label: "Open Email Workbench",
    hint: "Compose marketing emails from reusable blocks and sync them to Pardot",
    href: "/marketing-ops/email-workbench/create",
    icon: MegaphoneIcon,
    category: "Marketing Ops",
    tags: ["Email", "Workbench", "Pardot", "Templates", "Newsletter", "Marketing Ops"],
    hasWebApp: true,
    keywords: [
      "email workbench",
      "email",
      "pardot",
      "marketing email",
      "newsletter",
      "email template",
      "blocks",
    ],
  },
  {
    id: "mktg-event-platform",
    title: "Event Platform",
    label: "Open Event Platform",
    hint: "Plan conference agendas, manage speaker libraries, rooms, and event swag",
    href: "/marketing-ops/event-platform/events",
    icon: CalendarRangeIcon,
    category: "Marketing Ops",
    tags: ["Events", "Event Platform", "Speakers", "Agenda", "Conferences", "Marketing Ops"],
    hasWebApp: true,
    keywords: [
      "event platform",
      "conferences",
      "speakers",
      "event agenda",
      "event planning",
      "event shop",
    ],
  },

  // --- Knowledge & Learning ---
  {
    id: "knowledge-til",
    title: "Today I Learned (TIL)",
    label: "Open TIL Feed",
    hint: "Discover and share engineering insights, tricks, and technical knowledge",
    href: "/knowledge/today-i-learned",
    icon: BookOpenIcon,
    category: "Knowledge",
    tags: ["Knowledge", "TIL", "Learnings", "Documentation", "Wiki"],
    hasWebApp: true,
    keywords: [
      "today i learned",
      "til",
      "knowledge",
      "learnings",
      "insights",
      "wiki",
      "docs",
    ],
  },

  // --- Legal & Contracts ---
  {
    id: "legal-nda",
    title: "NDA Generator",
    label: "Open NDA Generator",
    hint: "Draft and download customized Mutual Non-Disclosure Agreements (NDA)",
    href: "/legal/nda",
    icon: FileSignatureIcon,
    category: "Legal",
    previewFlag: "nda",
    tags: ["NDA", "Confidentiality", "Legal", "Agreement"],
    hasWebApp: true,
    keywords: [
      "nda",
      "non disclosure",
      "agreement",
      "confidentiality",
      "mnda",
      "legal agreement",
    ],
  },
  {
    id: "legal-dd-partners",
    title: "Partner Due Diligence",
    label: "Open Partner Due Diligence",
    hint: "Review reseller partner applications, compliance risk, and approvals",
    href: "/legal/due-diligence/partners",
    icon: ScaleIcon,
    category: "Legal",
    tags: ["Due Diligence", "Partners", "Resellers", "Compliance", "Finance"],
    hasWebApp: true,
    keywords: [
      "due diligence",
      "partner due diligence",
      "reseller partners",
      "vetting",
      "partner finance",
      "compliance risk",
    ],
  },
  {
    id: "legal-dd-trades",
    title: "Trade References",
    label: "Open Trade References",
    hint: "Track trade reference verification and partner credit scoring",
    href: "/legal/due-diligence/trade-references",
    icon: ScaleIcon,
    category: "Legal",
    tags: ["Trade References", "Credit", "Partners", "Verification"],
    hasWebApp: true,
    keywords: [
      "trade references",
      "credit scoring",
      "partner credit",
      "trade verification",
    ],
  },

  // --- Security & Compliance ---
  {
    id: "sec-risk-hub",
    title: "Risk Hub",
    label: "Open Risk Hub",
    hint: "Identify, assess, and monitor technical, financial, and operational risks",
    href: "/security/risk/dashboard",
    icon: ShieldAlertIcon,
    category: "Security",
    tags: ["Risk", "Registers", "Assessment", "Mitigation", "Security", "GRC"],
    hasWebApp: true,
    keywords: [
      "risk hub",
      "risk register",
      "risk dashboard",
      "residual risk",
      "risk mitigation",
      "security",
      "compliance",
      "grc",
      "governance",
    ],
  },
  {
    id: "sec-audit-hub",
    title: "Audit Hub",
    label: "Open Audit Hub",
    hint: "Track SOC2, ISO27001, and HIPAA internal controls and audit testing",
    href: "/security/audit/dashboard",
    icon: ShieldCheckIcon,
    category: "Security",
    tags: ["Audit", "Controls", "SOC2", "ISO", "Evidence"],
    hasWebApp: true,
    keywords: [
      "audit hub",
      "audit",
      "soc2",
      "iso27001",
      "controls",
      "testing queue",
      "compliance audit",
    ],
  },
  {
    id: "sec-evidence-hub",
    title: "Evidence Portal",
    label: "Open Evidence Portal",
    hint: "Upload and manage compliance audit evidence and automated collector agents",
    href: "/security/evidence/dashboard",
    icon: DatabaseIcon,
    category: "Security",
    tags: ["Evidence", "Audit Evidence", "Screenshots", "Agents"],
    hasWebApp: true,
    keywords: [
      "evidence",
      "evidence portal",
      "audit evidence",
      "evidence collection",
      "agent runner",
    ],
  },
  {
    id: "sec-admin-console",
    title: "Security Admin Console",
    label: "Open Security Admin",
    hint: "Manage GRC user provisioning, risk teams, categories, and audit permissions",
    href: "/security/admin/users",
    icon: SlidersHorizontalIcon,
    category: "Security",
    tags: ["Security", "Admin", "Users", "GRC", "Risk Teams", "Audit Teams"],
    hasWebApp: true,
    keywords: [
      "security admin",
      "admin console",
      "grc admin",
      "provisioning",
      "risk teams",
      "audit teams",
      "security users",
    ],
  },

  // --- Engineering & Infrastructure ---
  {
    id: "eng-downloads",
    title: "Product Download Stats",
    label: "Open Download Stats",
    hint: "Analyze downloads for Ballerina, API Manager, Choreo, and Identity Server",
    href: "/engineering/downloads",
    icon: ChartColumnIcon,
    category: "Engineering",
    tags: ["Downloads", "Metrics", "Telemetry", "Analytics", "Ballerina", "Engineering"],
    hasWebApp: true,
    keywords: [
      "downloads",
      "download stats",
      "ballerina downloads",
      "apim downloads",
      "installer metrics",
      "engineering",
      "developer tools",
      "product engineering",
    ],
  },
  {
    id: "eng-repo-stats",
    title: "Repository Stats",
    label: "Open Repository Stats",
    hint: "Track GitHub repository metrics, commit activity, and community trends",
    href: "/engineering/repository-stats",
    icon: DatabaseIcon,
    category: "Engineering",
    tags: ["GitHub", "Repositories", "Stars", "Commits", "Stats"],
    hasWebApp: true,
    keywords: [
      "repository stats",
      "repo stats",
      "github metrics",
      "github stars",
      "commit activity",
    ],
  },
  {
    id: "eng-umt",
    title: "Update Management Tool (UMT)",
    label: "Open UMT App",
    hint: "Build product release chunks, track update versions, and monitor deployments",
    href: "/engineering/umt",
    icon: ServerIcon,
    category: "Engineering",
    tags: ["UMT", "Updates", "Releases", "Patches", "Chunks"],
    hasWebApp: true,
    keywords: [
      "umt",
      "update management",
      "release chunks",
      "patching",
      "product updates",
      "distribution",
    ],
  },
  // --- Infrastructure & GitHub ---
  {
    id: "infra-portal",
    title: "Infrastructure Portal",
    label: "Open Infra Portal",
    hint: "Connect GitHub accounts and configure organization-level access policies",
    href: "/infra/github/connection",
    icon: ServerIcon,
    category: "Infrastructure",
    tags: ["Infra", "GitHub", "Access", "Organization"],
    hasWebApp: true,
    keywords: [
      "infra",
      "infrastructure",
      "github connection",
      "infra portal",
      "github account",
    ],
  },
  {
    id: "infra-requests",
    title: "Repository Requests",
    label: "Open Repository Requests",
    hint: "Submit requests for new GitHub repositories.",
    href: "/infra/github/my-requests",
    icon: ServerIcon,
    category: "Infrastructure",
    tags: ["Repositories", "Infra", "GitHub", "Permissions", "Access"],
    hasWebApp: true,
    keywords: [
      "repository requests",
      "create repo",
      "github access",
      "repo permissions",
      "infra requests",
    ],
  },
  {
    id: "infra-reviews",
    title: "Repository Review Requests",
    label: "Review Repo Requests",
    hint: "Review pending repository creation and team permission grant requests",
    href: "/infra/github/review-repository-requests",
    icon: ServerIcon,
    category: "Infrastructure",
    tags: ["Infra", "Reviews", "Approvals", "GitHub", "Permissions"],
    hasWebApp: true,
    keywords: [
      "review repo requests",
      "infra reviews",
      "repo approvals",
      "github admin",
      "review repository",
    ],
  },
  {
    id: "infra-settings",
    title: "GitHub Settings",
    label: "Open GitHub Settings",
    hint: "Configure default organizations, topics, functional leads, and teams",
    href: "/infra/admin/github-settings",
    icon: SettingsIcon,
    category: "Infrastructure",
    tags: ["Infrastructure", "GitHub", "Settings", "Admin", "Organizations"],
    hasWebApp: true,
    keywords: [
      "github settings",
      "infra settings",
      "organization settings",
      "topics",
      "functional leads",
      "github admin",
    ],
  },

  // --- Swag Store ---
  {
    id: "store-shop",
    title: "Swag Store",
    label: "Open Swag Store",
    hint: "Redeem O2C coins for official WSO2 t-shirts, hoodies, and accessories",
    href: "/store",
    icon: ShoppingBagIcon,
    category: "Swag Store",
    previewFlag: "swagStore",
    tags: ["Store", "Swag", "Apparel", "Coins", "Merch"],
    hasWebApp: true,
    keywords: [
      "swag",
      "store",
      "shop",
      "coins",
      "merchandise",
      "t-shirt",
      "hoodie",
      "apparel",
    ],
  },
  {
    id: "store-cart",
    title: "Swag Cart",
    label: "Open Shopping Cart",
    hint: "View items in your cart, check coin balances, and proceed to checkout",
    href: "/store/cart",
    icon: ShoppingCartIcon,
    category: "Swag Store",
    previewFlag: "swagStore",
    tags: ["Cart", "Checkout", "Store", "Swag"],
    hasWebApp: true,
    keywords: [
      "cart",
      "checkout",
      "shopping cart",
      "swag cart",
      "coins checkout",
    ],
  },
  {
    id: "store-orders",
    title: "Swag Orders",
    label: "Open Orders History",
    hint: "Review your past swag purchases and track delivery to your office",
    href: "/store/orders",
    icon: PackageIcon,
    category: "Swag Store",
    previewFlag: "swagStore",
    tags: ["Orders", "Deliveries", "Shipments", "History"],
    hasWebApp: true,
    keywords: [
      "swag orders",
      "orders",
      "order history",
      "tracking",
      "delivery",
      "receipts",
    ],
  },
  {
    id: "store-alerts",
    title: "Swag Stock Alerts",
    label: "Open Stock Alerts",
    hint: "Manage back-in-stock notifications and alert subscriptions for swag items",
    href: "/store/alerts",
    icon: BellIcon,
    category: "Swag Store",
    previewFlag: "swagStore",
    tags: ["Alerts", "Notifications", "Stock", "Swag", "Store"],
    hasWebApp: true,
    keywords: [
      "swag alerts",
      "stock alerts",
      "notify me",
      "back in stock",
      "store alerts",
      "item notifications",
    ],
  },
  {
    id: "store-admin",
    title: "Swag Store Admin",
    label: "Open Store Admin",
    hint: "Manage swag catalog, inventory stock levels, orders, and office distribution",
    href: "/people-ops/swag-store",
    icon: ShoppingBagIcon,
    category: "Swag Store",
    previewFlag: "swagStore",
    tags: ["Admin", "Inventory", "Catalog", "Swag Admin", "Operations"],
    hasWebApp: true,
    keywords: [
      "swag store admin",
      "swag admin",
      "store inventory",
      "store catalog",
      "manage swag",
      "swag orders admin",
    ],
  },

  // --- Customer Success & Support ---
  {
    id: "csm-portal",
    title: "Customer Success Management (CSM)",
    label: "Open CSM",
    hint: "Access enterprise customer support tickets, SLA tracking, and accounts",
    href: csmUrl,
    icon: LifeBuoyIcon,
    category: "Support",
    tags: ["CSM", "Support", "Customer Success", "Tickets", "Accounts", "Helpdesk"],
    hasWebApp: true,
    isExternal: true,
    keywords: [
      "csm",
      "customer success",
      "customer success management",
      "support",
      "tickets",
      "helpdesk",
      "sla",
      "accounts",
      "jira support",
      "customer portal",
    ],
  },

  // --- Additional Marketing Ops ---
  {
    id: "mops-isac",
    title: "Information Security Assessment Portal (ISAC)",
    label: "Open ISAC",
    hint: "Review marketing security assessments, risk questionnaires, and compliance",
    href: isacUrl,
    icon: SatelliteDishIcon,
    category: "Marketing Ops",
    tags: ["ISAC", "Marketing", "Security Assessment", "Compliance", "Risk"],
    hasWebApp: true,
    isExternal: true,
    keywords: [
      "isac",
      "security assessment",
      "marketing security",
      "questionnaire",
      "vendor risk",
      "compliance assessment",
    ],
  },

  // --- Profile & Preferences ---
  {
    id: "me-profile",
    title: "My Profile",
    label: "View Profile",
    hint: "View personal details, emergency contacts, connected apps, and work history",
    href: "/me",
    icon: HouseIcon,
    category: "Me",
    tags: ["Profile", "Me", "Employee Details", "Emergency Contacts", "Connected Apps"],
    hasWebApp: true,
    keywords: [
      "profile",
      "me",
      "my profile",
      "personal info",
      "employee details",
      "connected apps",
      "emergency contact",
      "work history",
      "identity",
    ],
  },
  {
    id: "app-settings",
    title: "Settings & Preferences",
    label: "Open Settings",
    hint: "Configure interface preferences, dark mode, landing page, and notifications",
    href: "/settings",
    icon: SettingsIcon,
    category: "Me",
    tags: ["Settings", "Preferences", "Theme", "Dark Mode", "Landing Page"],
    hasWebApp: true,
    keywords: [
      "settings",
      "preferences",
      "dark mode",
      "theme",
      "landing page",
      "options",
      "configuration",
      "user settings",
    ],
  },
  {
    id: "po-resignations",
    title: "Resignations Report",
    label: "Open Resignations Report",
    hint: "Track employee departures, resignation pipeline, and team turnover metrics",
    href: "/people-ops/reports/resignations",
    icon: UsersIcon,
    category: "People Ops",
    requires: ["admin"],
    tags: ["Resignations", "Turnover", "Attrition", "Reports", "People Ops", "HR"],
    hasWebApp: true,
    keywords: [
      "resignations",
      "attrition",
      "turnover",
      "departures",
      "resignation report",
      "exit",
      "leaver",
    ],
  },
];

/**
 * Checks whether a given directory entry is permitted under the user's active capabilities and preview flags.
 *
 * @param entry The directory entry to check
 * @param userCaps The caller's capability set
 * @returns True if the entry is permitted for the given capabilities
 */
export function isDirectoryEntryPermitted(
  entry: DirectoryEntry,
  userCaps?: Set<Capability>,
): boolean {
  if (entry.id === "csm-portal" && !isCsmConfigured()) {
    return false;
  }
  if (entry.id === "mops-isac" && !isIsacConfigured()) {
    return false;
  }
  if (entry.previewFlag && !isPreviewEnabled(entry.previewFlag)) {
    return false;
  }
  if (!entry.requires || entry.requires.length === 0) {
    return true;
  }
  const caps = userCaps ?? new Set<Capability>(["employee"]);
  return entry.requires.some((r) => caps.has(r));
}

/**
 * Computes Levenshtein distance between two short strings for typo tolerance.
 *
 * @param a First string
 * @param b Second string
 * @returns Edit distance
 */
function editDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (Math.abs(a.length - b.length) > 2) {
    return 99;
  }
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev, dp[j], dp[j - 1]) + 1;
      }
      prev = temp;
    }
  }
  return dp[b.length];
}

/**
 * Computes a relevance score between a query and a directory entry.
 *
 * @param entry The directory entry to score
 * @param normalizedQuery Lowercased, trimmed search query
 * @param words Array of individual words in the query
 * @returns Relevance score from 0 (no match) upwards
 */
function scoreEntry(entry: DirectoryEntry, normalizedQuery: string, words: string[]): number {
  const titleLower = entry.title.toLowerCase();
  const categoryLower = entry.category.toLowerCase();

  // 1. Exact title match
  if (titleLower === normalizedQuery) {
    return 100;
  }

  // 2. Exact keyword alias match (explicit curated aliases take precedence over title prefixes)
  for (const kw of entry.keywords) {
    if (kw === normalizedQuery) {
      return 92;
    }
  }

  // 3. Title starts with query (prefix match outscores substring match)
  if (titleLower.startsWith(normalizedQuery)) {
    return 90;
  }

  // 4. Title contains the full query phrase
  if (titleLower.includes(normalizedQuery)) {
    return 80;
  }

  let bestScore = 0;

  // 5. Keyword phrase contained in query
  for (const kw of entry.keywords) {
    if (kw.includes(" ") && normalizedQuery.includes(kw)) {
      bestScore = Math.max(bestScore, 75);
    }
  }

  // 6. Category match
  if (categoryLower.includes(normalizedQuery)) {
    bestScore = Math.max(bestScore, 70);
  }

  // 7. Tag matches
  for (const tag of entry.tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === normalizedQuery) {
      bestScore = Math.max(bestScore, 65);
    } else if (words.includes(tagLower)) {
      bestScore = Math.max(bestScore, 55);
    }
  }

  // 8. Keyword partial and fuzzy matches
  for (const kw of entry.keywords) {
    if (words.includes(kw)) {
      bestScore = Math.max(bestScore, 40);
    } else if (kw.startsWith(normalizedQuery) && normalizedQuery.length >= 3) {
      bestScore = Math.max(bestScore, 38);
    } else {
      for (const w of words) {
        if (w.length >= 4 && kw.length >= 4 && editDistance(w, kw) <= 1) {
          bestScore = Math.max(bestScore, 35);
        }
      }
    }
  }

  // 9. Description / hint match
  if (entry.hint.toLowerCase().includes(normalizedQuery)) {
    bestScore = Math.max(bestScore, 20);
  }

  return bestScore;
}

/**
 * Searches the directory catalog and returns matching entries ranked by relevance.
 *
 * @param query User search query text
 * @param userCaps Optional caller capability set for role-based access filtering
 * @returns Array of matched directory entries
 */
export function searchDirectories(
  query: string,
  userCaps?: Set<Capability>,
): DirectoryEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(/[^a-z0-9_-]+/).filter(Boolean);
  const scored: { entry: DirectoryEntry; score: number }[] = [];

  for (const entry of DIRECTORY_CATALOG) {
    if (!isDirectoryEntryPermitted(entry, userCaps) || !entry.hasWebApp) {
      continue;
    }

    const score = scoreEntry(entry, normalized, words);
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.entry);
}
