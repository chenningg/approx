# Approx

Greenfield project to generate fake data based on some uploaded dataset.

## Running

You will need to go to the `/frontend` folder and make a `.env` file, copying the `.env.example` file and renaming it. Do the same in the `/api` folder. The defaults are fine - the application runs with the defaults in the respective `.env.example` files.

Then, in the root folder, run `make up` (requires GNU Make for Windows). This starts up the Docker containers for both the api and the frontend, along with the Laya classifier for column detection.

To run only the frontend or the api, go into the folder directly to use the `compose.yaml` files or directly via `make dev` for hot reload.
