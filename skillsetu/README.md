# SkillSetu · हुनर का सेतु

**Skills-first hiring on SAP BTP.** SkillSetu turns a person's life and work story, told in any language, into verified skills with evidence. It then finds fair job matches and a short, free learning plan. AI agents read **live open jobs from SAP SuccessFactors and SAP HANA Cloud over MCP**, and a human counsellor approves every case before anything reaches an employer.

> *AI shouldn't decide who gets left behind.* Built for SAP Hackfest 2026 by Up Down Coders.

## What it does

- **Any story counts.** Homemakers, ex-servicemen and career-gappers describe what they did (English, हिंदी, Hinglish, Tamil). SkillSetu turns it into skills, each one backed by a quote from their own words.
- **Fair matching.** Jobs are ranked on skills only. Age, career gaps, college and names are never used, and a four-fifths-rule bias audit shows what a typical résumé filter would have rejected.
- **Live SAP jobs.** The Market agent calls an SAP MCP server that reads open requisitions from SAP SuccessFactors, with SAP HANA Cloud as a second source.
- **Free learning plans.** The shortest course path (SAP Learning Hub, SWAYAM, NPTEL) to close the gap for a job.
- **Human in the loop.** A counsellor reviews skills, plan and fairness report. After approval, the application is written back to SuccessFactors under an anonymous case code.
- **Job Risk Radar.** For people already working: shows which tasks AI already does well and suggests safer roles, including open SAP jobs.

## How it fits together

```
Person (chat, any language)
   └─ Setu orchestrator ── picks the right agent ──┐
        Skills Discovery · Market Intelligence · Learning Pathway · Inclusive Matching
        Bias Audit · Why-Not · Job Risk Radar · After-Hire · Human-in-the-Loop
                                                    │
Market agent / Job Risk Radar ── MCP client ── SAP MCP server (mcp/sap-mcp.js)
                                                    ├─ SAP SuccessFactors Recruiting (JobRequisition, OData v2)
                                                    ├─ SAP HANA Cloud (SKILLSETU_JOB_REQUISITIONS)
                                                    └─ saved copy → sample (demo never breaks)
Counsellor approves ── SuccessFactors connector ── JobApplication with the real requisition ID
```

Every agent decision is shown in the **Agent trace** panel, including each MCP call and which SAP system answered.

**Stack:** SAP CAP (Node.js) · SAP UI5 Web Components (Fiori Horizon) · SAP SuccessFactors · SAP HANA Cloud · Model Context Protocol · Generative AI (Gemini / SAP AI Core) with a rules fallback · SQLite for local runs.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:4004. Demo sign-ins are in [DEMO-ACCOUNTS.md](DEMO-ACCOUNTS.md), or continue as a guest and click a story such as **Priya's story**.

Without any keys the app still works: rules instead of AI, and sample jobs instead of SAP.

### Optional keys (never commit them)

| What | File | How |
|---|---|---|
| Live SAP jobs | `sap-key.json` | Copy `sap-key.template.json`, add your [SAP API Hub](https://api.sap.com) key and/or HANA Cloud login. Guide: [mcp/sap/README.md](mcp/sap/README.md) |
| AI (Gemini) | `gemini-key.json` | Copy `gemini-key.template.json` |
| AI (SAP AI Core) | `aicore-key.json` | Copy `aicore-key.template.json` |

Check which SAP source answers: `npm run sap:check`. Fill HANA Cloud: `npm run sap:hana-setup`.

## Deploy to SAP BTP (Cloud Foundry)

```bash
cf login -a https://api.cf.us10-001.hana.ondemand.com --sso
cf push
```

`manifest.yml` deploys one Node.js app at skillsetu.cfapps.us10-001.hana.ondemand.com (change `routes` for your own account); the demo database is rebuilt on every start. Add keys once, then restage:

```bash
cf set-env skillsetu SAP_API_KEY <your SAP API Hub key>
cf set-env skillsetu GEMINI_API_KEY <your Gemini key>
cf restage skillsetu
```

HANA Cloud works the same way with `HANA_HOST`, `HANA_USER`, `HANA_PASSWORD` and `HANA_SCHEMA`.

## Use it from other AI assistants (MCP)

| Server | What it offers | How to connect |
|---|---|---|
| SkillSetu | Onboard a person, find jobs, learning plan, send to counsellor | stdio: `mcp/stdio.js` · HTTP: `POST /mcp` |
| SAP company data | `list_open_jobs`, `get_job`, `sap_connection_status` | stdio: `mcp/sap-stdio.js` · HTTP: `POST /sap-mcp` |

HTTP endpoints need the header `x-api-key: skillsetu-demo-key`. There is also a REST Integration API at `/integration/v1` (docs at `/api-docs.html`).

## Project layout

```
app/            web app (SAP Fiori look, UI5 Web Components)
srv/agents/     the nine agents and the orchestrator
srv/integrations/  SuccessFactors connector, SAP MCP client, webhooks
mcp/            MCP servers (SkillSetu and SAP company data)
mcp/sap/        SAP data sources, HANA setup, connection check
db/             CDS data model and demo data
```

Demand, salary and automation-risk values in the demo catalog are illustrative.
