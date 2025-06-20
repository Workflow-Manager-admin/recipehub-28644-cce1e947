import os
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import httpx
from starlette.status import HTTP_201_CREATED

# ENV vars for Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

app = FastAPI(
    title="Recipe App API",
    version="1.0.0",
    description="A FastAPI backend for a recipe management app with Supabase auth and storage.",
    openapi_tags=[
        {"name": "auth", "description": "User authentication and registration"},
        {"name": "recipes", "description": "Recipe CRUD endpoints"},
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class UserSignupRequest(BaseModel):
    email: EmailStr = Field(..., description="User email for registration")
    password: str = Field(..., min_length=6, description="User password (min 6 chars)")

class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Email for login")
    password: str = Field(..., description="Password for login")

class UserResponse(BaseModel):
    id: str
    email: EmailStr

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class RecipeCreate(BaseModel):
    title: str = Field(..., description="Recipe title")
    description: Optional[str] = Field(None, description="Recipe description")
    ingredients: List[str] = Field(..., description="List of ingredients")
    steps: List[str] = Field(..., description="List of preparation steps")

class RecipeUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    ingredients: Optional[List[str]]
    steps: Optional[List[str]]

class RecipeListItem(BaseModel):
    id: int
    user_id: str
    title: str
    description: Optional[str]
    ingredients: List[str]
    steps: List[str]

class RecipeListResponse(BaseModel):
    recipes: List[RecipeListItem]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# --- Utility functions for Supabase REST interface ---
async def supabase_request(method: str, path: str, json=None, params=None, headers=None, token=None):
    url = f"{SUPABASE_URL}{path}"
    supa_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    if headers:
        supa_headers.update(headers)
    if token:
        # Override auth with user's session token
        supa_headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient() as client:
        r = await client.request(method, url, json=json, params=params, headers=supa_headers)
        r.raise_for_status()
        return r

# --- AUTH HANDLERS ---

# PUBLIC_INTERFACE
@app.post("/auth/signup", response_model=UserResponse, tags=["auth"], summary="Register user", description="Register a new user using Supabase Auth")
async def register_user(payload: UserSignupRequest):
    """
    Registers a new user in Supabase with email & password.
    """
    url = f"{SUPABASE_URL}/auth/v1/signup"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json={"email": payload.email, "password": payload.password},
            headers=headers
        )
        if resp.status_code == 201 or resp.status_code == 200:
            data = resp.json()
            return UserResponse(id=data["user"]["id"], email=data["user"]["email"])
        elif resp.status_code == 400:
            raise HTTPException(status_code=400, detail=resp.json().get("msg", "Email already registered"))
        else:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

# PUBLIC_INTERFACE
@app.post("/auth/login", response_model=TokenResponse, tags=["auth"], summary="Login user", description="Authenticate user, returning JWT access token")
async def login_user(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Logs in a user using Supabase Auth and returns a session token.
    """
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json={
            "email": form_data.username,
            "password": form_data.password
        }, headers=headers)
        if resp.status_code in (200, 201):
            data = resp.json()
            return TokenResponse(access_token=data["access_token"], token_type="bearer")
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials.")

# --- AUTH GUARD ---
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Verifies a Supabase JWT token.
    """
    url = f"{SUPABASE_URL}/auth/v1/user"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            return resp.json()
        else:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")

# --- CRUD: RECIPES ---

# PUBLIC_INTERFACE
@app.get("/recipes", response_model=List[RecipeListItem], tags=["recipes"], summary="Get all recipes", description="List all recipes.")
async def list_recipes(search: Optional[str] = None):
    """
    Get all recipes. Optionally filter by title substring.
    """
    params = {}
    if search:
        params["title"] = f"ilike.%{search}%"
    url = f"/rest/v1/recipes"
    resp = await supabase_request("GET", url, params=params)
    data = resp.json()
    # ingredients/steps come as comma or array, coerce if needed
    for r in data:
        if isinstance(r.get('ingredients'), str):
            try:
                r['ingredients'] = eval(r['ingredients'])
            except Exception:
                r['ingredients'] = []
        if isinstance(r.get('steps'), str):
            try:
                r['steps'] = eval(r['steps'])
            except Exception:
                r['steps'] = []
    return [RecipeListItem(**r) for r in data]

# PUBLIC_INTERFACE
@app.get("/recipes/{recipe_id}", response_model=RecipeListItem, tags=["recipes"], summary="Get a recipe", description="Fetch a recipe by its ID.")
async def get_recipe(recipe_id: int):
    url = f"/rest/v1/recipes"
    params = {"id": f"eq.{recipe_id}"}
    resp = await supabase_request("GET", url, params=params)
    data = resp.json()
    if not data:
        raise HTTPException(status_code=404, detail="Recipe not found")
    r = data[0]
    if isinstance(r.get('ingredients'), str):
        try:
            r['ingredients'] = eval(r['ingredients'])
        except Exception:
            r['ingredients'] = []
    if isinstance(r.get('steps'), str):
        try:
            r['steps'] = eval(r['steps'])
        except Exception:
            r['steps'] = []
    return RecipeListItem(**r)

# PUBLIC_INTERFACE
@app.post("/recipes", response_model=RecipeListItem, tags=["recipes"], summary="Create recipe", description="Create a new recipe", status_code=HTTP_201_CREATED)
async def create_recipe(payload: RecipeCreate, user=Depends(get_current_user)):
    body = jsonable_encoder(payload)
    # Supabase expects array fields as stringified: e.g., '{"x", "y"}' or python list
    body["user_id"] = user["id"]
    url = "/rest/v1/recipes"
    resp = await supabase_request("POST", url, json=body, headers={"Prefer": "return=representation"})
    data = resp.json()
    r = data[0]
    if isinstance(r.get('ingredients'), str):
        try:
            r['ingredients'] = eval(r['ingredients'])
        except Exception:
            r['ingredients'] = []
    if isinstance(r.get('steps'), str):
        try:
            r['steps'] = eval(r['steps'])
        except Exception:
            r['steps'] = []
    return RecipeListItem(**r)

# PUBLIC_INTERFACE
@app.put("/recipes/{recipe_id}", response_model=RecipeListItem, tags=["recipes"], summary="Update a recipe", description="Update a recipe by ID.")
async def update_recipe(recipe_id: int, payload: RecipeUpdate, user=Depends(get_current_user)):
    # Only allow update if user's recipe
    url = "/rest/v1/recipes"
    params = {"id": f"eq.{recipe_id}", "user_id": f"eq.{user['id']}"}
    update_body = payload.dict(exclude_unset=True)
    resp = await supabase_request("PATCH", url, json=update_body, params=params, headers={"Prefer": "return=representation"})
    data = resp.json()
    if not data:
        raise HTTPException(status_code=404, detail="Recipe not found or not owned by user")
    r = data[0]
    if isinstance(r.get('ingredients'), str):
        try:
            r['ingredients'] = eval(r['ingredients'])
        except Exception:
            r['ingredients'] = []
    if isinstance(r.get('steps'), str):
        try:
            r['steps'] = eval(r['steps'])
        except Exception:
            r['steps'] = []
    return RecipeListItem(**r)

# PUBLIC_INTERFACE
@app.delete("/recipes/{recipe_id}", tags=["recipes"], summary="Delete recipe", description="Delete a recipe by ID")
async def delete_recipe(recipe_id: int, user=Depends(get_current_user)):
    # Verify ownership
    url = "/rest/v1/recipes"
    params = {"id": f"eq.{recipe_id}", "user_id": f"eq.{user['id']}"}
    resp = await supabase_request("DELETE", url, params=params)
    if resp.status_code == 204:
        return {"message": "Deleted recipe."}
    else:
        raise HTTPException(status_code=404, detail="Recipe not found or not owned by user.")

@app.get("/", tags=["health"])
def health_check():
    """Basic health check endpoint."""
    return {"message": "Healthy"}

