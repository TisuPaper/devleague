# Exia — Financial Document Analysis Portal

A modern, Notion-style portal for financial corporate staff to process client documents, identify missing data or format mismatches, and review AI-generated financial analysis reports.

## Table of Contents
1. [Problem Statement](#1-problem-statement)
2. [Solution & Features](#2-solution--features)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [System Overview](#5-system-overview)
6. [Future Roadmap](#6-future-roadmap)

## 1. Problem Statement
Processing client financial documents (like General Ledgers, Payroll Summaries, and AR Aging reports) is a tedious and manual process. Corporate staff spend too much time chasing clients for missing or incorrectly formatted documents rather than performing actual financial analysis. There is a strong need for a system that can pre-process these files and surface actionable issues immediately.

## 2. Solution & Features
Exia is a streamlined dashboard and workspace designed to automate the initial analysis of financial documents.

**Highlights:**
- **Automated Validation:** Instantly detects if submitted documents are missing or in the wrong format via an AI-powered data extraction pipeline.
- **AI-Generated Reports:** Automatically processes clean documents to generate comprehensive financial analysis reports using LLMs.
- **Actionable Workspaces:** A dedicated workspace per client featuring separated tabs for "Overview", "AI Report", and "Action Items" to reduce cognitive load.
- **Automated Communications:** Integrated email drafting allows staff to instantly send follow-ups to clients requesting specific missing or corrected documents.
- **Live Email Processing:** Seamlessly hooks into Gmail via a Push webhook to ingest client documents and instantly update the dashboard via a live status bar.
- **Impeccable Design:** A Notion-style aesthetic focusing on typography, subtle shadows, and minimal noise for a premium, distraction-free user experience.

## 3. Architecture
The system consists of a robust backend for processing and a lightning-fast React frontend for the corporate portal.

- **Backend (FastAPI):** Receives Gmail webhooks for incoming client emails, extracts attachments, runs a redaction pipeline, and analyzes financial documents using AI. 
- **Frontend (React/Vite):** A Single Page Application (SPA) that queries the backend. It features a dashboard to track onboarding and a dedicated Workspace View for reading AI reports and resolving issues.
- **Deployment:** A single-host Docker Compose deployment featuring Caddy for TLS termination and reverse-proxying.

## 4. Tech Stack
| Layer | Technologies |
| --- | --- |
| **Frontend** | React, Vite, JavaScript, Vanilla CSS |
| **Backend** | Python, FastAPI, Uvicorn, Google GenAI, PyPDF, OpenPyXL |
| **Infrastructure** | Docker, Docker Compose, Caddy |

## 5. System Overview
**Key Components:**
- `DashboardPage` & `ClientTable`: The main entry point displaying the unified client base.
- `LiveStatusBar`: A thin connection indicator providing visual feedback that the dashboard is synced with the live email ingestion pipeline.
- `ClientDetail`: The routing shell for a specific client's workspace.
- `ClientOverview`: Summary statistics and client metadata.
- `AnalysisWorkspace`: The core functional area that manages the state for Reports and Issues.
- `ReportPreview`: Full-width document viewer for the AI-generated report.

## 6. Future Roadmap
- **Live Document Viewer:** Add an inline PDF/Spreadsheet viewer for side-by-side comparison with the AI report.
- **Custom Email Templates:** Allow staff to edit and save custom follow-up email templates per client industry.
- **Multi-Tenant Support:** Expand the workspace to support different teams and roles within the financial corporation.