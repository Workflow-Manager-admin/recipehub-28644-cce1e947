import React, { useState, useEffect } from "react";
import "./App.css";

// API URL for backend (update to correct port/domain if needed)
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function App() {
  const [token, setToken] = useState(null); // JWT from backend
  const [user, setUser] = useState(null); // User email/id
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [mode, setMode] = useState("list"); // 'list', 'view', 'add', 'edit'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);

  // Authentication/Recipe state
  useEffect(() => {
    if (token) {
      fetchUser();
    }
    // Load recipes on first mount or on search
    fetchRecipes(search);
    // eslint-disable-next-line
  }, [token]);

  // Fetch current user from token (decode or ping backend if needed)
  async function fetchUser() {
    // No special backend endpoint; show just logged-in if token is present (simplified)
    setUser({}); // Optionally fetch from backend if needed in future
  }

  async function fetchRecipes(query = "") {
    let url = `${API_URL}/recipes`;
    if (query) url += `?search=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (res.ok) setRecipes(await res.json());
    else setRecipes([]);
  }

  async function handleLogin(email, password, isRegister) {
    if (isRegister) {
      // Register
      await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    }
    // Login (same for both)
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.access_token);
      setShowAuthModal(false);
    } else {
      alert("Login failed");
    }
  }

  async function handleAddRecipe(recipe) {
    const res = await fetch(`${API_URL}/recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(recipe),
    });
    if (res.ok) {
      setShowRecipeModal(false);
      fetchRecipes();
    } else {
      alert("Create recipe failed (maybe not logged in)");
    }
  }

  async function handleEditRecipe(id, updates) {
    const res = await fetch(`${API_URL}/recipes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setShowRecipeModal(false);
      fetchRecipes();
    } else {
      alert("Failed to update recipe (maybe not owner)");
    }
  }

  async function handleDeleteRecipe(id) {
    if (!window.confirm("Delete this recipe?")) return;
    const res = await fetch(`${API_URL}/recipes/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    if (res.ok) {
      fetchRecipes();
      setSelectedRecipe(null);
      setMode("list");
    } else {
      alert("Failed to delete");
    }
  }

  // Main Layout
  return (
    <div className="app" style={{ background: "#f4f5fa", minHeight: "100vh" }}>
      {/* Top Nav */}
      <nav className="navbar" style={{ background: "#4caf50", color: "white" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="logo" style={{ fontWeight: 700 }}>
            <span style={{ color: "#e91e63" }}>🍽️</span> RecipeHub
          </div>
          <div>
            {!token ? (
              <button className="btn" style={{ background: "#e91e63" }} onClick={() => setShowAuthModal(true)}>
                Login / Register
              </button>
            ) : (
              <button
                className="btn"
                style={{ background: "#FF9800" }}
                onClick={() => {
                  setToken(null);
                  setUser(null);
                }}
              >
                Log Out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Page */}
      <div style={{ display: "flex", paddingTop: 80, minHeight: "80vh" }}>
        {/* Sidebar Filters */}
        <aside
          style={{
            minWidth: 220,
            maxWidth: 250,
            padding: "32px 8px 8px 24px",
            background: "#fafbfc",
            borderRight: "1px solid #e1e1e5",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div>
            <input
              type="text"
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{
                width: "95%",
                padding: "8px",
                borderRadius: 4,
                border: "1px solid #ced3df",
                marginBottom: 12,
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter") fetchRecipes(search);
              }}
            />
            <button className="btn btn-large" style={{ width: "100%" }} onClick={() => fetchRecipes(search)}>
              Search
            </button>
          </div>
          <div>
            <button
              className="btn"
              style={{ background: "#4caf50", width: "100%" }}
              onClick={() => {
                if (!token) {
                  setShowAuthModal(true);
                  return;
                }
                setSelectedRecipe(null);
                setMode("add");
                setShowRecipeModal(true);
              }}
            >
              + Add Recipe
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="container" style={{ flex: 1, padding: "36px 32px 24px 32px" }}>
          {/* Recipe Cards/List */}
          {mode === "list" && (
            <div>
              <h2 style={{ margin: 0, marginBottom: 20 }}>
                {search ? `Search: "${search}"` : "All Recipes"}
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                {recipes.map((r) => (
                  <div
                    key={r.id}
                    className="card"
                    style={{
                      border: "1px solid #e2e5ef",
                      borderRadius: 8,
                      background: "#fff",
                      padding: 18,
                      boxShadow: "0 3px 8px 0 rgba(0,0,0,0.04)",
                      width: 260,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setSelectedRecipe(r);
                      setMode("view");
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 600, color: "#4caf50" }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 13, color: "#777", margin: "6px 0" }}>
                      {r.description ? r.description.substring(0, 90) : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#b89b2b" }}>
                      Ingredients: {r.ingredients.length}
                    </div>
                  </div>
                ))}
                {recipes.length === 0 && <span>No recipes found.</span>}
              </div>
            </div>
          )}

          {/* Recipe Details */}
          {mode === "view" && selectedRecipe && (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <button className="btn" style={{ marginBottom: 24 }} onClick={() => setMode("list")}>
                ← Back to List
              </button>
              <h2>{selectedRecipe.title}</h2>
              <div style={{ color: "#e91e63", marginBottom: 8 }}>
                <b>Ingredients ({selectedRecipe.ingredients.length}):</b>
              </div>
              <ul>
                {(selectedRecipe.ingredients || []).map((i, idx) =>
                  i ? <li key={idx}>{i}</li> : null
                )}
              </ul>
              <div style={{ marginBottom: 8, color: "#4caf50" }}>
                <b>Steps:</b>
              </div>
              <ol>
                {(selectedRecipe.steps || []).map((step, idx) =>
                  step ? <li key={idx}>{step}</li> : null
                )}
              </ol>
              {selectedRecipe.description && (
                <div style={{ color: "#777", margin: "14px 0" }}>
                  <b>Description:</b> {selectedRecipe.description}
                </div>
              )}
              {token && (
                <div style={{ marginTop: 24 }}>
                  <button
                    className="btn"
                    style={{ marginRight: 12, background: "#FF9800" }}
                    onClick={() => {
                      setShowRecipeModal(true);
                      setMode("edit");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn"
                    style={{ background: "#e91e63" }}
                    onClick={() => handleDeleteRecipe(selectedRecipe.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Modals */}
          {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onAuth={handleLogin} />}
          {showRecipeModal && (
            <RecipeModal
              onClose={() => {
                setShowRecipeModal(false);
                setMode("list");
                setSelectedRecipe(null);
              }}
              onSubmit={mode === "add"
                ? handleAddRecipe
                : (r) => handleEditRecipe(selectedRecipe.id, r)}
              recipe={mode === "edit" ? selectedRecipe : null}
              mode={mode}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * Auth Modal
 * @param {*} param0
 * @returns
 */
function AuthModal({ onClose, onAuth }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div style={modalStyle}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onAuth(email, password, isRegister);
        }}
        style={{
          minWidth: 280,
          background: "#fff",
          padding: 26,
          borderRadius: 8,
          boxShadow: "0 2px 18px #2222",
        }}
      >
        <h2>{isRegister ? "Register" : "Login"}</h2>
        <label>
          Email:
          <input
            type="email"
            className="input"
            style={inputStyle}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            className="input"
            style={inputStyle}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        <div style={{ margin: "18px 0 0 0" }}>
          <button className="btn btn-large" style={{ width: "100%" }} type="submit">
            {isRegister ? "Register" : "Login"}
          </button>
        </div>
        <div style={{ marginTop: 10, textAlign: "center" }}>
          {isRegister ? (
            <>
              Already have an account?
              <button
                className="btn"
                style={{ background: "#eee", color: "#333", marginLeft: 8 }}
                type="button"
                onClick={() => setIsRegister(false)}
              >
                Login
              </button>
            </>
          ) : (
            <>
              New here?
              <button
                className="btn"
                style={{ background: "#eee", color: "#333", marginLeft: 8 }}
                type="button"
                onClick={() => setIsRegister(true)}
              >
                Register
              </button>
            </>
          )}
        </div>
        <div style={{ textAlign: "center", margin: 16 }}>
          <button type="button" className="btn" style={{ background: "#999" }} onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </div>
  );
}

function RecipeModal({ onClose, onSubmit, recipe, mode }) {
  const [title, setTitle] = useState(recipe?.title || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [ingredients, setIngredients] = useState(Array.isArray(recipe?.ingredients) ? recipe.ingredients.join("\n") : "");
  const [steps, setSteps] = useState(Array.isArray(recipe?.steps) ? recipe.steps.join("\n") : "");

  return (
    <div style={modalStyle}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit({
            title,
            description,
            ingredients: ingredients.split(/\n|\r/).map(i => i.trim()).filter(Boolean),
            steps: steps.split(/\n|\r/).map(s => s.trim()).filter(Boolean),
          });
          onClose();
        }}
        style={{
          minWidth: 280,
          background: "#fbfbfb",
          padding: 26,
          borderRadius: 8,
          boxShadow: "0 2px 18px #2222",
          maxWidth: 420,
        }}
      >
        <h2>{mode === "add" ? "Add Recipe" : "Edit Recipe"}</h2>
        <label>
          Title:
          <input
            className="input"
            style={inputStyle}
            value={title}
            required
            onChange={e => setTitle(e.target.value)}
          />
        </label>
        <label>
          Description:
          <input
            className="input"
            style={inputStyle}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </label>
        <label>
          Ingredients (one per line):
          <textarea
            className="input"
            style={{ ...inputStyle, minHeight: 70 }}
            value={ingredients}
            onChange={e => setIngredients(e.target.value)}
            required
          />
        </label>
        <label>
          Steps (one per line):
          <textarea
            className="input"
            style={{ ...inputStyle, minHeight: 70 }}
            value={steps}
            onChange={e => setSteps(e.target.value)}
            required
          />
        </label>
        <div style={{ margin: "18px 0 0 0" }}>
          <button className="btn btn-large" style={{ width: "100%" }} type="submit">
            Save
          </button>
        </div>
        <div style={{ textAlign: "center", margin: 8 }}>
          <button type="button" className="btn" style={{ background: "#999" }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const modalStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.17)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const inputStyle = {
  margin: "4px 0 10px 0",
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #bbb",
  borderRadius: 5,
  fontSize: 16,
  background: "#f2f4fa"
};

export default App;