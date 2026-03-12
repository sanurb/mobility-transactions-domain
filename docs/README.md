# Cat Management API Documentation

This directory contains the auto-generated documentation for the Cat Management API built with Express Zod API.

## Generated Files

### OpenAPI Specification

- **`openapi.yaml`** - OpenAPI 3.1 specification in YAML format
- **`openapi.json`** - OpenAPI 3.1 specification in JSON format

### TypeScript Client

- **`api-client.ts`** - Type-safe TypeScript client for the API

### Schema Documentation

- **`schemas.md`** - Markdown documentation generated from Zod schemas using zod2md

## API Endpoints

### System Endpoints

- `GET /` - API information and available endpoints
- `GET /api/v1/health` - Health check endpoint

### Cat Management Endpoints

- `GET /api/v1/cats` - List all cats with pagination and filtering
- `POST /api/v1/cats` - Create a new cat
- `GET /api/v1/cats/:id` - Get a specific cat by ID
- `PUT /api/v1/cats/:id` - Update a specific cat
- `DELETE /api/v1/cats/:id` - Delete a specific cat

## Usage

### Using the TypeScript Client

```typescript
import { Client } from "./api-client";

const client = new Client();

// Get all cats
const cats = await client.provide("get /api/v1/cats", {
  page: "1",
  limit: "10",
});

// Create a new cat
const newCat = await client.provide("post /api/v1/cats", {
  name: "Whiskers",
  age: 3,
  breed: "Persian",
  color: "White",
  isAdopted: false,
});

// Get a specific cat
const cat = await client.provide("get /api/v1/cats/:id", {
  id: "123e4567-e89b-12d3-a456-426614174000",
});
```

### Using the OpenAPI Specification

The OpenAPI specification can be used with tools like:

- **Swagger UI** - For interactive API documentation
- **Postman** - For API testing and collection generation
- **Insomnia** - For API development and testing
- **Redoc** - For beautiful API documentation

## Regenerating Documentation

To regenerate the documentation after making changes to the API:

```bash
# Generate complete documentation
pnpm run docs:generate

# Generate only OpenAPI specification
pnpm run docs:openapi

# Generate only TypeScript client
pnpm run docs:client

# Generate only schema documentation
pnpm run docs:schemas

# Generate all documentation (OpenAPI + TypeScript client + Schema docs)
pnpm run docs:all
```

## Features

- **Type Safety**: Full TypeScript support with compile-time type checking
- **Validation**: Automatic request/response validation using Zod schemas
- **Documentation**: Auto-generated OpenAPI 3.1 specification
- **Client Generation**: Type-safe client code generation
- **Schema Documentation**: Markdown documentation generated from Zod schemas
- **Examples**: Comprehensive examples and descriptions
- **Tagging**: Proper endpoint categorization and organization

## Architecture

The documentation generation follows clean code principles:

- **Single Responsibility**: Each generator class has one specific purpose
- **Open/Closed**: Extensible design for adding new documentation formats
- **Dependency Inversion**: Abstract interfaces for documentation generation
- **DRY**: Reusable components and centralized configuration

## Schema Examples

All schemas include comprehensive examples and descriptions:

```typescript
// Cat schema with examples
const CatSchema = z.object({
  id: z.string().uuid().example("123e4567-e89b-12d3-a456-426614174000"),
  name: z.string().example("Whiskers"),
  age: z.number().int().example(3),
  breed: z.string().example("Persian"),
  color: z.string().example("White"),
  isAdopted: z.boolean().example(false),
  createdAt: z.date().example(new Date("2024-01-15T10:30:00Z")),
  updatedAt: z.date().example(new Date("2024-01-15T10:30:00Z")),
});
```

This ensures that the generated documentation includes meaningful examples and descriptions for all API endpoints and data structures.
