# XRT Services API

## Table of Contents
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-1)
  - [Users](#users)
  - [Plans](#plans)
  - [Subscriptions](#subscriptions)
  - [Invoices](#invoices)
  - [Services](#services)
  - [Admin](#admin)
  - [Dashboard](#dashboard)
  - [Clients](#clients)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Rate Limiting](#rate-limiting)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)

## Base URL
```
https://api.xrt-services.com/api/v1
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### Authentication

#### Register New User
- **URL**: `/auth/register`
- **Method**: `POST`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "fName": "John",
    "lName": "Doe",
    "email": "john@example.com",
    "password": "securePassword@123",
    "companyName": "Acme Inc",
    "phone": "(123) 456-7890",
    "role": "Client",
    "oldWebsite": "https://old-website.com"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Registration successful. Awaiting admin approval."
  }
  ```

#### User Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "securePassword@123"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "user_id_here",
      "email": "john@example.com",
      "fName": "John",
      "lName": "Doe",
      "role": "Client"
    }
  }
  ```

#### Refresh Token
- **URL**: `/auth/refresh`
- **Method**: `POST`
- **Access**: Public (with valid refresh token)
- **Request Body**:
  ```json
  {
    "refreshToken": "refresh_token_here"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "token": "new_jwt_token_here"
  }
  ```

### Users

#### Get Current User Profile
- **URL**: `/auth/me`
- **Method**: `GET`
- **Access**: Authenticated Users
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "id": "user_id_here",
      "email": "user@example.com",
      "fName": "John",
      "lName": "Doe",
      "companyName": "Acme Inc",
      "phone": "(123) 456-7890",
      "role": "Client"
    }
  }
  ```

### Plans

#### Get All Plans
- **URL**: `/plans`
- **Method**: `GET`
- **Access**: Public
- **Response**:
  ```json
  {
    "status": "success",
    "results": 3,
    "data": [
      {
        "id": "plan_id_here",
        "name": "Basic Plan",
        "description": "Basic website maintenance plan",
        "price": 99.99,
        "features": ["Feature 1", "Feature 2"],
        "billingCycle": "monthly"
      }
    ]
  }
  ```

### Subscriptions

#### Create Subscription
- **URL**: `/subscriptions`
- **Method**: `POST`
- **Access**: Authenticated Users
- **Request Body**:
  ```json
  {
    "planId": "plan_id_here",
    "paymentMethodId": "payment_method_id_here"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "id": "subscription_id_here",
      "status": "active",
      "plan": {
        "id": "plan_id_here",
        "name": "Basic Plan"
      },
      "nextBillingDate": "2025-12-31T00:00:00.000Z"
    }
  }
  ```

### Invoices

#### Get User Invoices
- **URL**: `/invoices`
- **Method**: `GET`
- **Access**: Authenticated Users
- **Response**:
  ```json
  {
    "status": "success",
    "results": 1,
    "data": [
      {
        "id": "invoice_id_here",
        "amount": 99.99,
        "status": "paid",
        "dueDate": "2025-11-30T00:00:00.000Z",
        "createdAt": "2025-11-01T10:00:00.000Z"
      }
    ]
  }
  ```

### Services

#### Get All Services
- **URL**: `/services`
- **Method**: `GET`
- **Access**: Public
- **Response**:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "service_id_here",
        "name": "Website Maintenance",
        "description": "Regular website updates and maintenance",
        "category": "Maintenance"
      }
    ]
  }
  ```

### Admin

#### Get All Users (Admin Only)
- **URL**: `/admin/users`
- **Method**: `GET`
- **Access**: Admin Only
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
- **Response**:
  ```json
  {
    "status": "success",
    "results": 15,
    "data": [
      {
        "id": "user_id_here",
        "email": "user@example.com",
        "fName": "John",
        "lName": "Doe",
        "role": "Client",
        "isActive": true
      }
    ]
  }
  ```

### Dashboard

#### Get Dashboard Stats
- **URL**: `/dashboard/stats`
- **Method**: `GET`
- **Access**: Authenticated Users
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "totalClients": 42,
      "activeSubscriptions": 35,
      "revenueThisMonth": 3499.30,
      "pendingInvoices": 3
    }
  }
  ```

## Error Handling

Errors follow this format:
```json
{
  "status": "error",
  "message": "Descriptive error message",
  "code": 400,
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Pagination

Paginated responses include:
- `page`: Current page number
- `limit`: Items per page
- `totalPages`: Total number of pages
- `total`: Total number of items

## Rate Limiting
- 100 requests per 15 minutes per IP address
- 1000 requests per day per user (authenticated)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=30d
JWT_COOKIE_EXPIRES_IN=30
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
FRONTEND_URL=http://localhost:3000
```

## Setup & Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (copy .env.example to .env and update values)
4. Start the server:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```
5. Access the API at `http://localhost:5000/api/v1`

## API Endpoints

### Authentication

#### Register New User
- **URL**: `/auth/register`
- **Method**: `POST`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "fName": "John",
    "lName": "Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "companyName": "Acme Inc",
    "phone": "(123) 456-7890",
    "role": "Client",  //default rule
    "oldWebsite": "https://old-website.com"
  }
  ```
- **Validation Rules**:
  - `fName` (required): User's first name
  - `lName` (required): User's last name
  - `email` (required, unique): Valid email address
  - `password` (required, min 8 characters)
  - `companyName` (required, 2-100 characters): Company/organization name
  - `phone` (required): US phone number in any of these formats:
    - (123) 456-7890
    - 123-456-7890
    - 123.456.7890
    - 1234567890
    - +1 (123) 456-7890
  - `oldWebsite` (optional): User's existing website URL
  - `role` (optional, default: 'client')

#### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "securePassword123"
  }
  ```

### Plans

#### Get All Plans
- **URL**: `/plans`
- **Method**: `GET`
- **Access**: Public
- **Query Params**:
  - `active` (boolean): Filter active/inactive plans
  - `billingCycle` (string): 'monthly' or 'yearly'

#### Create Plan (Admin)
- **URL**: `/plans`
- **Method**: `POST`
- **Access**: Admin only
- **Request Body**:
  ```json
  {
    "name": "Premium",
    "description": "Advanced plan",
    "monthlyPrice": 99.99,
    "yearlyPrice": 999.99,
    "features": ["Feature 1", "Feature 2"],
    "maxRestaurants": 5
  }
  ```

### Subscriptions

#### Subscribe to a Plan
- **URL**: `/subscriptions`
- **Method**: `POST`
- **Access**: Authenticated Users
- **Request Body**:
  ```json
  {
    "planId": "plan_id",
    "billingCycle": "yearly"
  }
  ```

#### Approve Subscription (Super Admin)
- **URL**: `/subscriptions/:subscriptionId/approve`
- **Method**: `POST`
- **Access**: Super Admin only
- **Request Body**:
  ```json
  {
    "startDate": "2025-01-01",
    "endDate": "2026-01-01",
    "invoiceNumber": "INV-2025-001"
  }
  ```

### Invoices

#### Record Payment
- **URL**: `/invoices/:invoiceId/payment`
- **Method**: `POST`
- **Access**: Admin
- **Request Body**:
  ```json
  {
    "amount": 999.99,
    "paymentDate": "2025-01-01",
    "paymentMethod": "bank_transfer",
    "transactionId": "TRX123456"
  }
  ```

### Services

#### Get All Services
- **URL**: `/services`
- **Method**: `GET`
- **Access**: Public
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "services": [
        {
          "id": "service_id",
          "title": "Web Development",
          "description": "Custom web development",
          "features": ["Responsive", "SEO Friendly"],
          "iconName": "web-dev"
        }
      ]
    }
  }
  ```

## Error Handling

All error responses follow this format:
```json
{
  "status": "error",
  "message": "Error message",
  "errors": {
    "field": "Error details"
  },
  "code": "ERROR_CODE"
}
```

### Common Error Status Codes
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `422` Validation Error
- `500` Internal Server Error

## Pagination

Endpoints that return lists support pagination:
- `?page=1` - Page number (default: 1)
- `?limit=10` - Items per page (default: 10, max: 100)

Pagination response format:
```json
{
  "status": "success",
  "pagination": {
    "total": 100,
    "page": 1,
    "pages": 10,
    "limit": 10
  },
  "data": {
    "items": []
  }
}
```

## Rate Limiting
- 100 requests per 15 minutes per IP address
- Headers:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/xrt-services
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USERNAME=your_email_username
EMAIL_PASSWORD=your_email_password
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (copy .env.example to .env)
4. Start the server:
   ```bash
   npm run dev    # Development
   npm start      # Production
   ```

## Testing

Run tests:
```bash
npm test
```

## License

This project is licensed under the MIT License.
