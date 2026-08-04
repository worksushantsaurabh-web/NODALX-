# nodalX AI

nodalX AI is an inquiry-operations workspace for businesses. It receives inbound business inquiries, sends them through an AI classification workflow, and gives the team a focused queue of records that need a response or a next action.

The product outcome is simple: fewer lost inquiries, faster qualification, and a clear handoff from website form to the right business system.

The published dashboard is intentionally centered on four jobs:

1. See open and total inquiries from the connected source.
2. Review the inquiry queue and status.
3. Monitor configured automations.
4. Connect or repair the inquiry pipeline.

Unconfigured environments show an explicit connection state instead of demo records.

## Prerequisites

To run this application locally, you need:

*   **[Google Cloud SDK / gcloud CLI](https://cloud.google.com/sdk/docs/install)**: Follow the instructions to install the SDK.

*   **gcloud Initialization**:
    *   Initialize the gcloud CLI:
        ```bash
        gcloud init
        ```
    *   Authenticate for Application Default Credentials (needed to call Google Cloud APIs):
        ```bash
        gcloud auth application-default login
        ```

*   **Node.js and npm**: Ensure you have Node.js and its package manager, `npm`, installed on your machine.

## Project Structure

The project is organized into two main directories:

*   `frontend/`: Contains the Frontend application code.
*   `backend/`: Contains the Node.js/Express server code to proxy Google Cloud API calls.

## Backend Environment Variables

The `backend/.env.local` file is automatically generated when you download this application.
It contains essential Google Cloud environment variables pre-configured based on your project settings at the time of download.

The variables set in `backend/.env.local` are:
*   `API_BACKEND_PORT`: The port the backend API server listens on (e.g., `5000`).
*   `API_PAYLOAD_MAX_SIZE`: The maximum size of the request payload accepted by the backend server (e.g., `5mb`).
*   `GOOGLE_CLOUD_LOCATION`: The Google Cloud region associated with your project.
*   `GOOGLE_CLOUD_PROJECT`: Your Google Cloud Project ID.

The backend also uses Firebase Admin SDK for Firestore and Firebase ID-token verification. In local development, provide Application Default Credentials with `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path. In Firebase/Google Cloud hosting, use the platform's attached service account instead of committing credentials.

**Note:** These variables are automatically populated during the download process.
You can modify the values in `backend/.env.local` if you need to change them.

## n8n and Airtable Integration

nodalX sends browser requests only to its local backend. The backend forwards them to n8n, and n8n owns the Airtable credentials and record operations.

Copy `backend/.env.example` values into `backend/.env.local` and add your n8n webhook URLs:

* `N8N_INQUIRY_WEBHOOK_URL`: accepts `POST` requests from the inquiry form and creates or updates an Airtable lead.
* `N8N_CUSTOMERS_WEBHOOK_URL`: accepts `GET` requests and returns Airtable records. It may return an array directly, `{ "customers": [...] }`, or Airtable's `{ "records": [{ "id": "...", "fields": { ... } }] }` format.
* `N8N_FLOW_TEST_WEBHOOK_URL`: optional `POST` endpoint that returns an array of simulation log entries.

Authentication (email/password, phone OTP, and Google sign-in) is handled entirely by Firebase Authentication on the frontend — no backend or n8n configuration is required.

Never expose Airtable personal access tokens or n8n webhook secrets in the frontend.

### Recommended production flow

`Website form -> POST /api/inquiries -> n8n -> AI classification -> Airtable/CRM -> GET /api/customers -> nodalX dashboard`

The n8n workflow should return a stable record shape containing `id`, `name`, `email`, `status`, and a timestamp field such as `updatedAt`. The backend normalizes Airtable-style `{ records: [{ id, fields }] }` responses for the dashboard.

### Useful integrations

- Airtable or a CRM as the inquiry system of record.
- n8n for orchestration, AI classification, routing, and notifications.
- Slack or Microsoft Teams for high-priority inquiry alerts.
- Gmail or an email provider for acknowledgements and follow-up drafts.
- Google Sheets for lightweight reporting during the first launch phase.
- Firebase Authentication for workspace access and Firestore for persistent flows and settings.

The Node backend persists workspace flows, profiles, and data-source settings in Firestore under `users/{uid}`. The browser sends the Firebase ID token in the `Authorization` header; the backend verifies it before accessing workspace data.

Before publishing, configure the inquiry and customer webhooks, verify a real form submission reaches the system, confirm the dashboard queue refreshes, and remove any local development webhook URLs.

## Installation and Running the App

To install dependencies and run your Google Cloud Vertex AI Studio App locally, execute the following command:

```bash
npm install && npm run dev
