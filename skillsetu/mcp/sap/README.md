# SkillSetu agents → MCP → SAP

```
Market Intelligence agent
   └─ MCP client (srv/integrations/sap-mcp-client.js)
        └─ SAP MCP server (mcp/sap-mcp.js, its own process over stdio; also POST /sap-mcp)
             ├─ 1. SAP SuccessFactors Recruiting  (JobRequisition, OData v2)
             ├─ 2. SAP HANA Cloud                 (table SKILLSETU_JOB_REQUISITIONS)
             └─ 3. last good SuccessFactors copy, then a built-in sample (demo never breaks)
```

The agent asks for open jobs, scores each one on skills only (skills are read from the job's own description),
and shows the best ones under **Open now in SAP** in the jobs card. The **Agent trace** panel shows an
`SAP MCP` line with the tool name, which SAP system answered and how long it took.

Tools on the SAP MCP server: `list_open_jobs`, `get_job`, `sap_connection_status` (read-only).

## Step 1: SAP API key (SuccessFactors sandbox), about 5 minutes

1. Open https://api.sap.com and click **Log On** (top right). Any free SAP account works.
2. Search for **Job Requisition** and open the API from the *SAP SuccessFactors Recruiting* package.
3. Click your profile icon (top right) → **Settings** → **Show API Key** → **Copy Key and Close**.
4. In the `skillsetu` folder, copy `sap-key.template.json` to `sap-key.json` and paste the key into `"apiKey"`.
5. Run `npm run sap:check`. You should see `answered by: SAP SuccessFactors (API Hub sandbox)`.
   A good answer is also saved to `mcp/sap/last-sync.json`, so the demo still shows SAP data if the Wi-Fi drops.

## Step 2 (optional): SAP HANA Cloud from the Hackfest, about 10 minutes

1. Get your HANA Cloud details from the Hackfest Learning Hub / BAS page: **host** (looks like
   `xxxx.hana.prod-xx10.hanacloud.ondemand.com`), **user** (`HACKFEST0266`) and **password**. Port is `443`.
2. Put them in the `"hana"` part of `sap-key.json`.
3. Run `npm run sap:hana-setup`. It creates the table `SKILLSETU_JOB_REQUISITIONS` in your schema and fills it
   (from SuccessFactors if Step 1 works, otherwise from the sample).
4. Run `npm run sap:check`. The second block ("Asking hana first") should say `answered by: SAP HANA Cloud`.
   If it times out, the HANA instance may be stopped or may not allow your network.

## Step 3: restart SkillSetu

Stop the running server (Ctrl+C) and start it again with `npm start`. Ask the chat "show me jobs".

## Use it from Claude Desktop too

Settings → Developer → Edit Config, then add:

```json
{ "mcpServers": { "sap": { "command": "/full/path/to/node", "args": ["/full/path/to/skillsetu/mcp/sap-stdio.js"] } } }
```

Any web MCP client can use `POST http://localhost:4004/sap-mcp` with header `x-api-key: skillsetu-demo-key`.

## Real tenant later

Set `sfUrl`, `sfUser` (`user@companyId`) and `sfPassword` in `sap-key.json` to read a real SuccessFactors tenant
instead of the sandbox. Keys can also come from environment variables: `SAP_API_KEY`, `SAP_SF_URL`,
`SAP_SF_USER`, `SAP_SF_PASSWORD`, `HANA_HOST`, `HANA_PORT`, `HANA_USER`, `HANA_PASSWORD`, `HANA_SCHEMA`.
`sap-key.json` is in `.gitignore`.
