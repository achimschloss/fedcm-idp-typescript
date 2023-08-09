# FedCM Prototyping IDP

This is an standalone demonstrator IDP implementation in typescript that provides basic functionality
for creating accounts with an IDP, logging in and logging out of an IDP as a prerequisite to test Browser and RP implementations of the [FedCM API](https://fedidcg.github.io/FedCM/).

This is **absolutely** not meant for production use and does not implement any security mechanism for the base IDP functionality, use this for demonstration/prototyping/testing purposes only.

## Getting Started

To get started:

1. Clone this repository
2. Install node.js and npm
3. Install dependencies

   ```shell
   npm install
   ```

4. Build the project

   ```shell
   npm run build
   ```

5. Run on localhost (Port 8080)

   ```shell
   npm run start-local
   ```

**Note:** It is not supported to run multiple IDPs on different localhost ports or different ports on the same hostname (i.e. `localhost:8080` and `localhost:8081`).

## Deployment options

This setup currently supports three deployment options. It can be run on locally, deployed using dedicated domains (default) and via Heroku (deployed on localhost, Heroku takes care of the rest)

### Default deployment

The default deployment assumes that the setup is using dedicated etlD+1s to run IDPs.
This setup currently supports running any number of IDP - supported IDP hostnames will be fetched from the `idp_metadata.json` configuration file and started automatically accordingly.

Start the server once the domains are set using

```shell
npm start
```

The IDPs will be available on the given hostnames via **https**.

### Local deployment

#### Single IDP

Start server using.

```shell
npm start-local
```

The IDP will be available on `localhost:8080` via **http**, w.r.t to configuring the FedCM Browser API call on the RP side use `configURL: http://localhost:8080/fedcm.json`

#### Multiple IDPs

This setup currently supports running any number of IDP locally - supported IDP hostnames will be fetched from the `idp_metadata.json` configuration file and started automatically accordingly.

In order to run multiple IDPs locally use multiple `.localhost` hostnames, e.g. `idp-1.localhost`, `idp-2.localhost`, etc. and add them to the `idp_metadata.json` configuration file.

**Note:** This of course requires you to add the respective hostnames to your `/etc/hosts` file to point to 127.0.0.1

Start the server once the domains are set using

```shell
npm start-local
```

The IDPs will be available on the given hostnames via **http** on port 8080, w.r.t to configuring the FedCM Browser API call on the RP side use `configURL: http://idp-1.localhost:8080/fedcm.json` and so on.

### Heroku

This setup can be deployed via Heroku PaaS - Follow the respective instructions [here](https://devcenter.heroku.com/articles/git) - Other than Heroku specifics no further configuration is necessary, the setup will automatically fetch the Heroku app domain and adjust accordingly.

## Certificate configuration

In case not run locally or via Heroku this setup expects a `certs` subdirectory in the root of the project containing a subdirectory for the configured domains. Basic setup:

Create the certs directory

```shell
mkdir certs
```

Create directory for your IDP domain(s)

```shell
mkdir certs/your-first-idp-domain.com
```

Put the respective certificates into this directory, i.e. `privkey.pem` and `fullchain.pem`

Make sure access rights to both the folders and the files are setup correctly.

## General configuration

### Clients

Supported Clients must be configured in `config/client_metadata.json`. Note that eligible clients and origins are validated as defined in the FedCM specification.

### IDPs

IDP configuration is contained in `config/idp_metadata.json`. In order to host an IDP on a etlD+1 / other than localhost (configured by default for local deployment), add a respective entry to the JSON configuration object (may contain multiple). The branding configuration can be adjusted to your needs per IDP.

```json
    "your-domain-goes-here": {
        "branding": {
            "background_color": "rgb(255, 255, 204)",
            "color": "0xffffff",
            "icons": [
                {
                    "url": "{baseUrl}/images/yourlogo.webp",
                    "size": 32
                }
            ]
        }
    }
```

`{baseUrl}` is automatically replaced at runtime, additional IDP logos must be place in `src/public/images`

## Supported features

IDP User management:

- Create account
- Delete account
- Sign-in / Sign-out
- Account persistence in PouchDB
- Profile Page (show user info)
- passkey support (single authenticator per user, passwordless login)
- Approved Clients Management (display, revoke)

IDP:

- Client registration (static, build time)
- IDP registration (static, build time)
- Baseline FedCM related security
  - Clients checks (origin, referer, etc.)
  - Accounts mismatch checks

FedCM API:

- Baseline APIs
  - .well-known/web-identity
  - IDP manifest (fedcm.json)
  - accounts_endpoint
  - id-assertion-endpoint
- Extended APIs
  - UserInfo API (personalized login button)
  - IDP Sign-In API
  - Limited Support for AuthZ (Scope management)

## Known working browsers

- Chrome 115, 116 (Android, MacOS)
- Chrome Canary 117 (Android, MacOS)
- Edge 115, 116 (Android, MacOS)
