# Approx

Greenfield project to generate representative synthetic data based on some uploaded real (ground truth) dataset.

## Running

You will need to go to the `/frontend` folder and make a `.env` file, copying the `.env.example` file and renaming it. Do the same in the `/api` folder. The defaults are fine - the application runs with the defaults in the respective `.env.example` files.

NOTE: If you set `AUTH_ENABLED="true"` in api's `.env`, the default admin account has the following details hardcoded - email: `approx_admin@test.com`, username: `approx_admin`, password: `approx_admin`. Use these credentials to login.

Then, in the root folder, run `make up` (requires GNU Make for Windows). This starts up the Docker containers for both the api and the frontend, along with the Laya classifier for column detection. By default, the frontend runs at `localhost:5173` and the api runs at `localhost:8080/docs`.

To run only the frontend or the api, go into the folder directly to use the `compose.yaml` files or directly via `make dev` for hot reload.

Example Excel files to upload can be found under `/examples`, along with a helper script to generate more fake ("real") data for testing.
