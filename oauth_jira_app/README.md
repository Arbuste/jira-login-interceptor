# Jira OAuth 2.0 Webapp

This is a tiny Flask webapp demonstrating OAuth 2.0 (3LO) with Jira Cloud.

## Setup

1. Create an app in the [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/).
   - Add OAuth 2.0 (3LO).
   - Set callback URL to `http://localhost:5000/callback`.
   - Add scopes: `read:jira-user`, `read:jira-work`.
   - Note the Client ID and Secret.

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Edit `app.py` and replace:
   - `CLIENT_ID` with your Client ID.
   - `CLIENT_SECRET` with your Secret.
   - Change `app.secret_key` to a random string.

4. Run the app:
   ```
   python app.py
   ```

5. Open http://localhost:5000 in your browser.

6. Click "Authorize with Jira" to start the OAuth flow.

7. After authorization, you'll see your Jira user info.

## What it does

- Redirects to Atlassian for authorization.
- Exchanges the code for an access token.
- Fetches accessible resources to get the cloud ID.
- Makes a Jira API call to get the current user's info.
- Displays the JSON response.