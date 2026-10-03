const API_URL = "http://localhost:5000/api";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("registerForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {

            const response = await fetch(
                `${API_URL}/auth/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        name,
                        email,
                        password
                    })
                }
            );

            const data = await response.json();

            if (response.ok) {

                alert("Account created successfully!");

                window.location.href = "login.html";

            } else {

                alert(data.message || "Registration failed");

            }

        } catch (error) {

            console.error(error);

            alert(
                "Cannot connect to backend. Please make sure the server is running."
            );
        }
    });
});