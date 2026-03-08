const { app } = require("./app");
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("");
  console.log("  Pizza Depot Digital Signage Server");
  console.log("  Admin:   http://localhost:" + PORT + "/admin");
  console.log("  Login:   http://localhost:" + PORT + "/login");
  console.log("  Display: http://localhost:" + PORT + "/display/:id/:num");
  console.log("");
  console.log("  Default login: admin / admin123");
  console.log("");
});
