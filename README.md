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
- **Automated Validation:** Instantly detects if submitted documents are missing or in the wrong format.
- **AI-Generated Reports:** Automatically processes clean documents to generate comprehensive financial analysis reports.
- **Actionable Workspaces:** A dedicated workspace per client featuring separated tabs for "Overview", "AI Report", and "Action Items" to reduce cognitive load.
- **Automated Communications:** Integrated email drafting allows staff to instantly send follow-ups to clients requesting specific missing or corrected documents.
- **Impeccable Design:** A Notion-style aesthetic focusing on typography, subtle shadows, and minimal noise for a premium, distraction-free user experience.

## 3. Architecture
The frontend is a React Single Page Application (SPA) built with Vite that provides a seamless, lightning-fast dashboard experience. 

- **Dashboard View:** Tracks client onboarding progress, document submission ratios, and last activity timestamps in a unified table.
- **Workspace View:** Selecting a client opens a detailed view with a clean top-navigation structure.
- **Analysis Modules:** The workspace intentionally separates the AI Report (a distraction-free reading view) from Action Items (an inbox-style list of pending issues) for better accessibility and readability.

## 4. Tech Stack
| Layer | Technologies |
| --- | --- |
| **Frontend** | React, Vite, JavaScript |
| **Styling** | Vanilla CSS, Custom Design System (Impeccable heuristics, Notion-inspired) |

## 5. System Overview
**Key Components:**
- `DashboardPage` & `ClientTable`: The main entry point displaying the unified client base.
- `ClientDetail`: The routing shell for a specific client's workspace.
- `ClientOverview`: Summary statistics and client metadata.
- `AnalysisWorkspace`: The core functional area that manages the state for Reports and Issues.
- `ReportPreview`: Full-width document viewer for the AI-generated report.
- `IssueCard` & `EmailPreviewModal`: The follow-up resolution flow and communication triggers.

## 6. Future Roadmap
- **Backend AI Integration:** Connect the UI to the live AI processing and validation backend.
- **Live Document Viewer:** Add an inline PDF/Spreadsheet viewer for side-by-side comparison with the AI report.
- **Custom Email Templates:** Allow staff to edit and save custom follow-up email templates per client industry.
- **Multi-Tenant Support:** Expand the workspace to support different teams and roles within the financial corporation.