# FedCM Prototyping IDP

This is an standalone demonstrator IDP implementation in typescript that provides basic functionality
for creating accounts with an IDP, logging in and logging out of an IDP as a prerequisite to test Browser and RP implementations of the [FedCM API](https://fedidcg.github.io/FedCM/).

This is **absolutely** not meant for production use and does not implement any security mechanism for the base IDP functionality, use this for demonstration/prototyping/testing purposes only.

## Getting Started

To get started:

1. Clone this repository
2. Install node.js and npm
3. Install Dependencies

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

   Note that as of now running on localhost will only allow you to play around with the base IDP functionality given the FedCM-APIs cannot be called in a non secure context.

## Deployment options

This setup currently supports three deployment options. It can be run on localhost, deployed using dedicated domains (default) and via Heroku (deployed on localhost, Heroku takes care of the rest)

### Default deployment

The default deployment assumes that the setup is using dedicated eTLD+1s to run IDPs. To configure those simply set the environment variables `DOMAIN_1` and `DOMAIN_2` and run the IDP(s).

```shell
npm start
```

This setup currently supports running the two IDPs configured via the env variables using one https server with separate SNI context. This can easily be extended to also test more complex multi IDP scenarios with multiple eTLD+1 domain, as of now it will always try to load two certificates this can easily be changed. 

### Localhost

Start server using, see note above. This will not enable you to test the FedCM APIs

```shell
npm start-local
```

### Heroku

This setup can be deployed via Heroku PaaS - Follow the respective instructions [here](https://devcenter.heroku.com/articles/git) - Other than Heroku specifics not further configuration is necessary, the setup will automatically fetch the Heroku app domain and adjust accordingly.

## Certificate configuration

The setups expects a `certs` subdirectory in the root of the project containing a subdirectory for the configured domains. Basic setup:

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

Supported Clients must be configured in `src/config/client_metadata.json`. Note that eligible clients and origins are validated as defined in the FedCM specification.  

### IDPs

IDP configuration is contained in `src/config/client_metadata.json`. In order to host an IDP on a domain other than localhost, add a respective entry to the JSON configuration. The branding configuration can be adjusted to you needs. **Do not change the endpoint configuration**

```json
    "your-domain-goes-here": {
        "accounts_endpoint": "/fedcm/accounts_endpoint",
        "client_metadata_endpoint": "/fedcm/client_metadata_endpoint",
        "id_assertion_endpoint": "/fedcm/token_endpoint",
        "revocation_endpoint": "/fedcm/revocation_endpoint",
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
    },
```

`{baseUrl}` is automatically replaced at runtime, additional IDP logos must be place in `src/public/images`

## Supported Features

TODO
