(function () {
  var stage = document.getElementById("quiz-stage");
  var stepLabel = document.getElementById("quiz-step");
  var scoreLabel = document.getElementById("quiz-score-live");
  var progressBar = document.getElementById("quiz-progress-bar");
  var progressCount = document.getElementById("quiz-completions");
  if (!stage) return;

  var questions = [
    {
      prompt: "Illustrative scenario: a caller says a payment was sent to you by mistake and asks you to share your M-Pesa PIN so they can reverse it. What is the safest next step?",
      options: ["Share the PIN so the caller can verify you", "End the call and check your own transaction history through an official channel", "Send a small amount first to confirm the caller"],
      answer: 1,
      explanation: "Keep your PIN private. Check your own account records and contact the provider through its official app or website. Do not rely on a caller’s instructions or a screenshot."
    },
    {
      prompt: "An online job offer asks you to pay a registration fee before you can see the contract. What should you do?",
      options: ["Pay quickly so you do not lose the opportunity", "Verify the employer and vacancy independently before sharing details or money", "Send your ID and account details to reserve the role"],
      answer: 1,
      explanation: "An upfront fee and pressure to act are warning signs. Verify the organisation through contact details you find independently, and do not send sensitive details to an unverified recruiter."
    },
    {
      prompt: "You followed a link from an unexpected account alert and entered your password. What is a useful first response?",
      options: ["Open the link again and try another password", "Go to the service using its official app or website, change the password, and review active sessions", "Wait to see whether the sender contacts you again"],
      answer: 1,
      explanation: "Use a trusted route to the real service, change the exposed password, change it anywhere else it was reused, and revoke sessions you do not recognise."
    },
    {
      prompt: "A marketplace buyer sends a payment screenshot and urges you to hand over an item. What should you check?",
      options: ["The screenshot’s logo and colour", "Your own account or the marketplace’s official transaction record", "The buyer’s promise to pay later"],
      answer: 1,
      explanation: "Screenshots can be edited. Confirm the payment in your own account or the platform before releasing goods."
    },
    {
      prompt: "A group chat promises guaranteed investment returns if you recruit friends and transfer money today. What is the safer choice?",
      options: ["Pause and independently check the offer and provider before acting", "Borrow money because guaranteed returns are low risk", "Forward the offer so others can decide"],
      answer: 0,
      explanation: "Guaranteed returns, recruitment pressure, and urgency deserve scrutiny. Verify a provider through the relevant regulator’s official resources and never invest money you cannot afford to lose."
    }
  ];

  var current = 0;
  var score = 0;
  var answered = false;

  function readCompletionCount() {
    try {
      var saved = Number(window.localStorage.getItem("jua.quizRoundsCompleted") || 0);
      return Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
    } catch (error) {
      return null;
    }
  }

  function updateProgressCount() {
    if (!progressCount) return;
    var count = readCompletionCount();
    if (count === null) {
      progressCount.textContent = "—";
      progressCount.parentElement.setAttribute("aria-label", "Quiz progress cannot be saved in this browser");
    } else {
      progressCount.textContent = String(count);
    }
  }

  function renderQuestion() {
    answered = false;
    var question = questions[current];
    stepLabel.textContent = "Question " + (current + 1) + " of " + questions.length;
    scoreLabel.textContent = "Score: " + score;
    progressBar.style.width = Math.round((current / questions.length) * 100) + "%";
    stage.replaceChildren();

    var prompt = document.createElement("h3");
    prompt.className = "quiz-question";
    prompt.textContent = question.prompt;
    stage.appendChild(prompt);

    var choices = document.createElement("div");
    choices.className = "quiz-options";
    choices.setAttribute("role", "group");
    choices.setAttribute("aria-label", "Answer choices");
    question.options.forEach(function (option, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.textContent = option;
      button.addEventListener("click", function () { chooseAnswer(index, choices); });
      choices.appendChild(button);
    });
    stage.appendChild(choices);
  }

  function chooseAnswer(selectedIndex, choices) {
    if (answered) return;
    answered = true;
    var question = questions[current];
    var correct = selectedIndex === question.answer;
    if (correct) score += 1;
    scoreLabel.textContent = "Score: " + score;

    Array.from(choices.querySelectorAll("button")).forEach(function (button, index) {
      button.disabled = true;
      if (index === question.answer) button.classList.add("is-correct");
      else if (index === selectedIndex) button.classList.add("is-incorrect");
    });

    var feedback = document.createElement("p");
    feedback.className = "quiz-feedback";
    feedback.setAttribute("role", "status");
    feedback.textContent = (correct ? "That is the safer choice. " : "Not quite. ") + question.explanation;
    stage.appendChild(feedback);

    var controls = document.createElement("div");
    controls.className = "quiz-controls";
    var spacer = document.createElement("span");
    spacer.textContent = "";
    var next = document.createElement("button");
    next.type = "button";
    next.className = "button-primary";
    next.textContent = current === questions.length - 1 ? "See your result" : "Next scenario →";
    next.addEventListener("click", function () {
      if (current < questions.length - 1) {
        current += 1;
        renderQuestion();
      } else {
        finishQuiz();
      }
    });
    controls.append(spacer, next);
    stage.appendChild(controls);
    next.focus();
  }

  function finishQuiz() {
    stepLabel.textContent = "Quiz complete";
    scoreLabel.textContent = "Score: " + score + " / " + questions.length;
    progressBar.style.width = "100%";
    try {
      var count = readCompletionCount();
      if (count !== null) window.localStorage.setItem("jua.quizRoundsCompleted", String(count + 1));
    } catch (error) {
      // Quiz results still work when browser storage is unavailable.
    }
    updateProgressCount();
    stage.replaceChildren();

    var result = document.createElement("div");
    result.className = "quiz-result";
    var scoreText = document.createElement("div");
    scoreText.className = "quiz-result-score";
    scoreText.textContent = score + " / " + questions.length;
    var explanation = document.createElement("p");
    explanation.textContent = score === questions.length
      ? "Excellent work. Keep pausing to verify unexpected requests through a trusted channel."
      : "Use the explanations to practise. A score is for learning only and does not certify expertise.";
    var restart = document.createElement("button");
    restart.type = "button";
    restart.className = "button-secondary";
    restart.textContent = "Restart quiz";
    restart.addEventListener("click", startQuiz);
    result.append(scoreText, explanation, restart);
    stage.appendChild(result);
  }

  function startQuiz() {
    current = 0;
    score = 0;
    renderQuestion();
  }

  updateProgressCount();
  startQuiz();
})();
