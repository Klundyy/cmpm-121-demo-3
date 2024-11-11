// todo
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const button = document.createElement("button");
button.innerHTML = "click";
app.append(button);
button.addEventListener("click", () => {
  alert("you clicked the button!");
});
