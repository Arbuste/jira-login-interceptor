# Group Membership API Configuration Examples

This file contains examples and use cases for the Group Membership Auto-Joiner extension.

## Primary Use Case: Auto-Join Group on Login

When a user logs in, automatically add them to a configured group. This is useful for:

- **Onboarding**: Automatically add new employees to company-wide groups
- **Role-Based Access**: Add contractors to specific project groups on login
- **Compliance**: Ensure all active users are members of required groups
- **Team Management**: Automatically manage team membership without manual intervention

### Configuration Example

```
Organization ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Directory ID: b2c3d4e5-f6a7-8901-bcde-f1234567890a
Group ID: c3d4e5f6-a7b8-9012-cdef-234567890abc
Bearer Token: <your-api-token>
```

### What Happens

1. User logs in to Jira
2. Extension extracts user's account ID from login cookies
3. Extension makes POST request:
   ```
   POST https://api.atlassian.com/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships
   Authorization: Bearer <token>
   Content-Type: application/json
   
   {
     "accountId": "user-account-id"
   }
   ```
4. User is now a member of the group
5. User is redirected to their destination

## Finding Your Organization and Directory IDs

### Method 1: Admin Console (Easy)

1. Go to https://admin.atlassian.com
2. Click **Organization settings** (bottom left)
3. Go to **Identity & Access**
4. Click **Directories**
5. Your Organization ID appears in the URL and in the settings
6. Your Directory ID is shown next to each directory

### Method 2: API Call

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://api.atlassian.com/admin/v2/orgs
```

Returns a list of organizations with their IDs.

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://api.atlassian.com/admin/v2/orgs/{orgId}/directories
```

Returns a list of directories with their IDs.

## Finding Your Group ID

### Method 1: Admin Console (Easy)

1. Go to https://admin.atlassian.com
2. Click **People** → **Groups**
3. Click on the group you want
4. The Group ID is displayed (UUID format)

### Method 2: API Call

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://api.atlassian.com/admin/v2/orgs/{orgId}/directories/{directoryId}/groups
```

Returns a list of groups with their IDs.

## Testing Your Configuration

Before enabling auto-join, test the API configuration:

### Using cURL

```bash
curl -X POST \
  "https://api.atlassian.com/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "YOUR_ACCOUNT_ID"
  }'
```

### Using Postman

1. Create a new POST request
2. URL: `https://api.atlassian.com/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships`
3. Headers:
   - `Authorization: Bearer YOUR_API_TOKEN`
   - `Content-Type: application/json`
   - `Accept: application/json`
4. Body (raw JSON):
   ```json
   {
     "accountId": "YOUR_ACCOUNT_ID"
   }
   ```
5. Click Send
6. Success should return 204 No Content

### Using Python

```python
import requests

url = "https://api.atlassian.com/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships"
headers = {
    "Authorization": "Bearer YOUR_API_TOKEN",
    "Accept": "application/json",
    "Content-Type": "application/json"
}
data = {
    "accountId": "YOUR_ACCOUNT_ID"
}

response = requests.post(url, headers=headers, json=data)
print(f"Status: {response.status_code}")
print(f"Message: {response.text}")
```

## Getting Your Account ID

### Finding Your Own Account ID

When the extension runs, it extracts your account ID from the `__aid_user_id` cookie during login. You can also find it manually:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://api.atlassian.com/site/{cloudId}/v1/users/me
```

The response contains your `accountId` field.

### For Test Purposes

When testing with cURL/Postman, use any valid account ID from your directory.

## Common Group Use Cases

### All Employees Group

Auto-add all login users to an "All Employees" or "Everyone" group.

**Setup**:
- Create a group named "All Employees"
- Get the Group ID
- Configure extension with this group ID
- Every user who logs in will be auto-added

### Project-Specific Group

Add contractors or external users to specific project groups.

**Setup**:
- Create groups per project (e.g., "Project-X-Team")
- Install multiple extension instances, each pointing to a different group
- Each user gets added to their relevant project group on login

### Compliance Groups

Ensure all active users are members of required compliance/auditing groups.

**Setup**:
- Create "Compliance-Required-Users" group
- Configure extension to auto-add all logins
- Everyone stays compliant automatically

### Department Groups

Organize users by department in a multi-department organization.

**Setup**:
- This extension handles adding to one group per instance
- Use directory-level user properties to assign users to department groups
- Extension ensures they're in the primary team group

## API Response Codes

When the extension makes the API call:

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | User added successfully |
| 201 | Created | User added (first time) |
| 204 | No Content | User added successfully (no response body) |
| 400 | Bad Request | Invalid accountId or request format |
| 401 | Unauthorized | API token is invalid or expired |
| 403 | Forbidden | API token doesn't have group management permissions |
| 404 | Not Found | orgId, directoryId, or groupId doesn't exist |
| 409 | Conflict | User is already a member of the group |
| 429 | Rate Limited | Too many requests - try again later |
| 500+ | Server Error | Atlassian server issue - try again later |

## Permission Requirements

Your API token needs the following scopes:

- `admin:org:admin` - Manage organization settings
- `admin:directory:manage` - Manage directory and groups

To verify your token has the right permissions:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://api.atlassian.com/site/{cloudId}/v1/oauth-tokens/introspect \
     -d '{"token": "YOUR_API_TOKEN"}'
```

## Security Best Practices

1. **Create a Dedicated Token**: Create an API token specifically for this extension
   - Easier to revoke if compromised
   - Can be revoked independently from other tokens

2. **Use Minimal Permissions**: Only grant permissions needed for group management
   - Avoid giving full admin permissions

3. **Monitor Usage**:
   - Regularly check admin logs to see when users are added to groups
   - Set up alerts for failed group membership additions

4. **Token Rotation**: Periodically create new tokens and revoke old ones
   - Reduces impact of compromised tokens
   - Improves security over time

5. **Secure Storage**:
   - Chrome stores the token in encrypted sync storage
   - Only accessible by your Chrome profile on trusted devices

## Multiple Groups

To add users to multiple groups:

1. Install the extension multiple times with different profiles (if needed)
2. Or manually add users to multiple groups via the admin console

Note: This extension currently handles one group per installation. For mass assignment to multiple groups, consider using Atlassian's user assignment tools or a custom automation script.

## Troubleshooting API Calls

### 401 Unauthorized
- Your API token was invalid or has expired
- Create a new token and update the extension

### 403 Forbidden
- Your token doesn't have permission to manage groups
- Ensure token has `admin:org:admin` and `admin:directory:manage` scopes
- Create a new token with proper permissions

### 404 Not Found
- Organization ID, Directory ID, or Group ID is incorrect
- Verify all IDs are in UUID format
- Double-check IDs in admin console

### 409 Conflict
- User is already a member of the group
- This is normal behavior - extension will report success even if already member
- No action needed

### No Response / Timeout
- Check your internet connection
- Verify Atlassian API servers are running (check status.atlassian.com)
- Extension will retry on next login

## Advanced: Conditional Group Membership

For more complex scenarios, consider:

1. Using Atlassian's native user provisioning (SCIM)
2. Custom directory synchronization
3. Directory-level automation rules
4. Combining with external identity providers (OKTA, Azure AD, etc.)

This extension provides basic auto-join functionality. For sophisticated authentication workflows, use Atlassian's Directory Sync, SCIM, or custom integrations.

---

**Last Updated**: 2026-02-19
