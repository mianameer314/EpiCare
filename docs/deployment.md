# EpiCare — Deployment Guide

## Docker Compose

The project includes a `docker-compose.yml` file to orchestrate the backend, frontend, and PostgreSQL database.

```powershell
docker compose up --build
```

This starts:
- PostgreSQL on port `:5432`
- FastAPI Backend on port `:8000`
- React Frontend on port `:5173`

## Environment Variables

Ensure you have created a `.env` file at the root or within the `backend/` directory depending on your compose configuration. See `docs/configuration.md` for the list of required variables.

> [!NOTE]
> The React frontend is implemented and can be run through Docker Compose or directly with Vite. Production deployment still requires valid database, authentication, storage, email, and notification provider variables. Production RAG retrieval and VLM report generation remain future milestones; see [`implementation_status.md`](implementation_status.md).
