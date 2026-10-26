import os
from flask import Flask, redirect, request, session, url_for, render_template
import requests

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Change this to a random secret

# Replace these with your actual app credentials from https://developer.atlassian.com/console/myapps/
CLIENT_ID = 'La53Amxap8nBJu6dZvHM7JFxFnWDIKSw'
CLIENT_SECRET = 'ATOAyiaXzqdoqaBxubEZKbyMvYs_TVG4aCsV9H2hdpG6tPSd-Psng45CsJqAKZAgIJAg0023C545'
REDIRECT_URI = 'http://localhost:5000/callback'

AUTH_URL = 'https://auth.atlassian.com/authorize'
TOKEN_URL = 'https://auth.atlassian.com/oauth/token'
ACCESSIBLE_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources'

ACCESS_TOKEN = ''
CLOUDID = ''

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/authorize')
def authorize():
    # Generate a simple state (in production, use secure random)
    state = 'random_state_123'
    session['state'] = state
    params = {
        'audience': 'api.atlassian.com',
        'client_id': CLIENT_ID,
        'scope': 'read:servicedesk-request write:servicedesk-request read:cmdb-object:jira',
        'redirect_uri': REDIRECT_URI,
        'state': state,
        'response_type': 'code',
        'prompt': 'consent'
    }
    auth_url = f"{AUTH_URL}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
    return redirect(auth_url)

@app.route('/myrequests')
def showRequests():
    if ACCESS_TOKEN != '' and CLOUDID != '':
        headers = {'Authorization': f'Bearer {ACCESS_TOKEN}'}
        res_response = requests.get(f'https://api.atlassian.com/ex/jira/{CLOUDID}/rest/servicedeskapi/request', headers=headers)
        if res_response.status_code == 200:
            return render_template('result.html',data=res_response.json())
        else:
            return render_template('error.html',error=res_response)
    else:
        return render_template('error.html')
    
@app.route('/myassets')
def showAssets():
    workspaceId = '27f65366-99ed-4fa0-aeae-1f69d441df74'
    if ACCESS_TOKEN != '' and CLOUDID != '':
        headers = {'Authorization': f'Bearer {ACCESS_TOKEN}'}
        res_response = requests.post(f'https://api.atlassian.com/ex/jira/{CLOUDID}/jsm/assets/workspace/{workspaceId}/v1/object/aql', headers=headers, json={"qlQuery": "name = ACT37SPPF"})
        if res_response.status_code == 200:
            return render_template('result.html',data=res_response.json())
        else:
            print(str(res_response))
            return render_template('error.html',error=res_response)
    else:
        return render_template('error.html')

@app.route('/callback')
def callback():
    code = request.args.get('code')
    state = request.args.get('state')
    if state != session.get('state'):
        return 'Invalid state parameter', 400

    # Exchange authorization code for access token
    data = {
        'grant_type': 'authorization_code',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code': code,
        'redirect_uri': REDIRECT_URI
    }
    response = requests.post(TOKEN_URL, json=data)
    if response.status_code != 200:
        return f'Error exchanging code: {response.text}', 400
    token_data = response.json()
    global ACCESS_TOKEN
    ACCESS_TOKEN = token_data['access_token']

    # Get accessible resources to find cloudid
    headers = {'Authorization': f'Bearer {ACCESS_TOKEN}'}
    res_response = requests.get(ACCESSIBLE_RESOURCES_URL, headers=headers)
    if res_response.status_code != 200:
        return f'Error getting resources: {res_response.text}', 400
    resources = res_response.json()
    if not resources:
        return 'No accessible resources found', 400
    # Assume the first resource is Jira
    global CLOUDID
    CLOUDID = resources[0]['id']

    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)