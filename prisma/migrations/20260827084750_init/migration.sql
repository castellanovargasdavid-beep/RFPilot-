-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('UPLOADING', 'EXTRACTING', 'EXTRACTION_FAILED', 'EXTRACTED', 'ANALYZING', 'ANALYSIS_FAILED', 'READY');

-- CreateEnum
CREATE TYPE "TenderSourceType" AS ENUM ('PUBLIC_TENDER', 'CORPORATE_RFP');

-- CreateEnum
CREATE TYPE "PliegoDocument" AS ENUM ('PCAP', 'PPT');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('CERTIFICATION', 'FINANCIAL', 'TECHNICAL_EXPERIENCE', 'LEGAL_ADMINISTRATIVE', 'TEAM_QUALIFICATION', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "LegalRequirementType" AS ENUM ('SOLVENCIA_ECONOMICA', 'SOLVENCIA_TECNICA', 'HABILITACION_EMPRESARIAL', 'PROHIBICION_CONTRATAR');

-- CreateEnum
CREATE TYPE "RequirementCertaintyLevel" AS ENUM ('ALTO', 'DUDOSO', 'AMBIGUO');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('EMPTY', 'GENERATING', 'GENERATED', 'EDITED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('DOCX', 'PDF');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('PAY_AS_YOU_GO', 'PRO', 'AGENCY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('PLAN_GRANT', 'PAY_AS_YOU_GO_PURCHASE', 'TENDER_ANALYSIS', 'PROPOSAL_DRAFT', 'MANUAL_ADJUSTMENT', 'REFUND');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "taxIdEncrypted" TEXT,
    "legalForm" TEXT,
    "foundedYear" INTEGER,
    "employeeCount" INTEGER,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueYear" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amountEncrypted" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',

    CONSTRAINT "RevenueYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "certificateNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceReference" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "description" TEXT,
    "amountEncrypted" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "yearsExperience" INTEGER,
    "qualifications" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "TenderSourceType" NOT NULL DEFAULT 'PUBLIC_TENDER',
    "contractingBody" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "status" "TenderStatus" NOT NULL DEFAULT 'UPLOADING',
    "statusMessage" TEXT,
    "extractedText" TEXT,
    "extractedTextIsOcr" BOOLEAN NOT NULL DEFAULT false,
    "extractionMethod" TEXT,
    "submissionDeadline" TIMESTAMP(3),
    "clarificationDeadline" TIMESTAMP(3),
    "maxBudget" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDocumentBlock" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "documento" "PliegoDocument" NOT NULL,
    "pagina" INTEGER NOT NULL,
    "clausula" TEXT,
    "parrafo" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "bboxX" DOUBLE PRECISION NOT NULL,
    "bboxY" DOUBLE PRECISION NOT NULL,
    "bboxW" DOUBLE PRECISION NOT NULL,
    "bboxH" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "TenderDocumentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderAnalysis" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "companyProfileId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "promptVersion" TEXT NOT NULL,
    "modelUsed" TEXT,
    "scopeSummary" TEXT,
    "executiveSummaryJson" JSONB,
    "eligibilityStatus" "EligibilityStatus",
    "eligibilityScore" DOUBLE PRECISION,
    "requirementsSectionUnclear" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusionRequirement" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "citationText" TEXT,
    "citationPage" INTEGER,
    "citationClause" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tipo" "LegalRequirementType",
    "esExcluyente" BOOLEAN,
    "documentoPliego" "PliegoDocument",
    "nivelCerteza" "RequirementCertaintyLevel",
    "pendienteRevisionHumana" BOOLEAN NOT NULL DEFAULT false,
    "bboxX" DOUBLE PRECISION,
    "bboxY" DOUBLE PRECISION,
    "bboxW" DOUBLE PRECISION,
    "bboxH" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExclusionRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringCriterion" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weightPercent" DOUBLE PRECISION NOT NULL,
    "maxPoints" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "citationText" TEXT,
    "citationPage" INTEGER,
    "citationClause" TEXT,
    "documentoPliego" "PliegoDocument",
    "nivelCerteza" "RequirementCertaintyLevel",
    "pendienteRevisionHumana" BOOLEAN NOT NULL DEFAULT false,
    "bboxX" DOUBLE PRECISION,
    "bboxY" DOUBLE PRECISION,
    "bboxW" DOUBLE PRECISION,
    "bboxH" DOUBLE PRECISION,

    CONSTRAINT "ScoringCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityCheck" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status" "EligibilityStatus" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "matchedProfileFact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalDraft" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "companyProfileId" TEXT,
    "title" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSection" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "content" TEXT,
    "status" "SectionStatus" NOT NULL DEFAULT 'EMPTY',
    "errorMessage" TEXT,
    "wordCountTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalExport" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'PAY_AS_YOU_GO',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "relatedTenderId" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertKeyword" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertMatch" (
    "id" TEXT NOT NULL,
    "alertKeywordId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceBoard" TEXT,
    "publishedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenderId" TEXT,
    "userId" TEXT,
    "step" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE INDEX "CompanyProfile_organizationId_idx" ON "CompanyProfile"("organizationId");

-- CreateIndex
CREATE INDEX "CompanyProfile_clientId_idx" ON "CompanyProfile"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueYear_companyProfileId_year_key" ON "RevenueYear"("companyProfileId", "year");

-- CreateIndex
CREATE INDEX "Certification_companyProfileId_idx" ON "Certification"("companyProfileId");

-- CreateIndex
CREATE INDEX "Certification_expiresAt_idx" ON "Certification"("expiresAt");

-- CreateIndex
CREATE INDEX "ExperienceReference_companyProfileId_idx" ON "ExperienceReference"("companyProfileId");

-- CreateIndex
CREATE INDEX "TeamMember_companyProfileId_idx" ON "TeamMember"("companyProfileId");

-- CreateIndex
CREATE INDEX "Tender_organizationId_status_idx" ON "Tender"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Tender_organizationId_submissionDeadline_idx" ON "Tender"("organizationId", "submissionDeadline");

-- CreateIndex
CREATE INDEX "TenderDocumentBlock_tenderId_pagina_idx" ON "TenderDocumentBlock"("tenderId", "pagina");

-- CreateIndex
CREATE INDEX "TenderDocumentBlock_tenderId_order_idx" ON "TenderDocumentBlock"("tenderId", "order");

-- CreateIndex
CREATE INDEX "TenderAnalysis_tenderId_version_idx" ON "TenderAnalysis"("tenderId", "version");

-- CreateIndex
CREATE INDEX "ExclusionRequirement_analysisId_idx" ON "ExclusionRequirement"("analysisId");

-- CreateIndex
CREATE INDEX "ScoringCriterion_analysisId_idx" ON "ScoringCriterion"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityCheck_requirementId_key" ON "EligibilityCheck"("requirementId");

-- CreateIndex
CREATE INDEX "EligibilityCheck_analysisId_idx" ON "EligibilityCheck"("analysisId");

-- CreateIndex
CREATE INDEX "ProposalDraft_tenderId_idx" ON "ProposalDraft"("tenderId");

-- CreateIndex
CREATE INDEX "ProposalSection_draftId_idx" ON "ProposalSection"("draftId");

-- CreateIndex
CREATE INDEX "ProposalSection_parentId_idx" ON "ProposalSection"("parentId");

-- CreateIndex
CREATE INDEX "ProposalExport_draftId_idx" ON "ProposalExport"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_organizationId_createdAt_idx" ON "CreditLedgerEntry"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertKeyword_organizationId_idx" ON "AlertKeyword"("organizationId");

-- CreateIndex
CREATE INDEX "AlertMatch_alertKeywordId_idx" ON "AlertMatch"("alertKeywordId");

-- CreateIndex
CREATE INDEX "AiUsageLog_organizationId_createdAt_idx" ON "AiUsageLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_tenderId_idx" ON "AiUsageLog"("tenderId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueYear" ADD CONSTRAINT "RevenueYear_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceReference" ADD CONSTRAINT "ExperienceReference_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDocumentBlock" ADD CONSTRAINT "TenderDocumentBlock_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderAnalysis" ADD CONSTRAINT "TenderAnalysis_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderAnalysis" ADD CONSTRAINT "TenderAnalysis_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionRequirement" ADD CONSTRAINT "ExclusionRequirement_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "TenderAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringCriterion" ADD CONSTRAINT "ScoringCriterion_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "TenderAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "TenderAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ExclusionRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalDraft" ADD CONSTRAINT "ProposalDraft_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalDraft" ADD CONSTRAINT "ProposalDraft_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProposalDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProposalSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalExport" ADD CONSTRAINT "ProposalExport_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProposalDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertKeyword" ADD CONSTRAINT "AlertKeyword_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertMatch" ADD CONSTRAINT "AlertMatch_alertKeywordId_fkey" FOREIGN KEY ("alertKeywordId") REFERENCES "AlertKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

