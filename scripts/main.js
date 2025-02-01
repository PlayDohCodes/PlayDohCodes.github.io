(() => {
  "use strict";

  // Utility functions grouped into a single object
  const Utils = {
    // Parse pixel values to numeric values
    parsePx: (value) => parseFloat(value.replace(/px/, "")),

    // Generate a random number between two values, optionally with a fixed precision
    getRandomInRange: (min, max, precision = 0) => {
      const multiplier = Math.pow(10, precision);
      const randomValue = Math.random() * (max - min) + min;
      return Math.floor(randomValue * multiplier) / multiplier;
    },

    // Pick a random item from an array
    getRandomItem: (array) => array[Math.floor(Math.random() * array.length)],

    // Scaling factor based on screen width
    getScaleFactor: () => Math.log(window.innerWidth) / Math.log(1920),

    // Debounce function to limit event firing frequency
    debounce: (func, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
      };
    },
  };

  // Precomputed constants
  const DEG_TO_RAD = Math.PI / 180;

  // Centralized configuration for default values
  const defaultConfettiConfig = {
    confettiesNumber: 295,
    confettiRadius: 5,
    confettiColors: [
      "#c3c77e",
      "#c7548c",
      "#6d3ba6",
      "#20c371",
      "#11888d",
      "#a6660e",
      "#a40e0e",
      "#34a40e"
    ],
    emojies: [],
    svgIcon: null, // Example SVG link
  };

  // Confetti class representing individual confetti pieces
  class Confetti {
    constructor({ initialPosition, direction, radius, colors, emojis, svgIcon }) {
      const speedFactor = Utils.getRandomInRange(0.9, 1.7, 3) * Utils.getScaleFactor();
      this.speed = { x: speedFactor, y: speedFactor };
      this.finalSpeedX = Utils.getRandomInRange(0.2, 0.6, 3);
      this.rotationSpeed = emojis.length || svgIcon ? 0.01 : Utils.getRandomInRange(0.03, 0.07, 3) * Utils.getScaleFactor();
      this.dragCoefficient = Utils.getRandomInRange(0.0005, 0.0009, 6);
      this.radius = { x: radius, y: radius };
      this.initialRadius = radius;
      this.rotationAngle = direction === "left" ? Utils.getRandomInRange(0, 0.2, 3) : Utils.getRandomInRange(-0.2, 0, 3);
      this.emojiRotationAngle = Utils.getRandomInRange(0, 2 * Math.PI);
      this.radiusYDirection = "down";

      const angle = direction === "left" ? Utils.getRandomInRange(82, 15) * DEG_TO_RAD : Utils.getRandomInRange(-15, -82) * DEG_TO_RAD;
      this.absCos = Math.abs(Math.cos(angle));
      this.absSin = Math.abs(Math.sin(angle));

      const offset = Utils.getRandomInRange(-150, 0);
      const position = {
        x: initialPosition.x + (direction === "left" ? -offset : offset) * this.absCos,
        y: initialPosition.y - offset * this.absSin
      };

      this.position = { ...position };
      this.initialPosition = { ...position };
      this.color = emojis.length || svgIcon ? null : Utils.getRandomItem(colors);
      this.emoji = emojis.length ? Utils.getRandomItem(emojis) : null;
      this.svgIcon = null;

      // Preload SVG if provided
      if (svgIcon) {
        this.svgImage = new Image();
        this.svgImage.src = svgIcon;
        this.svgImage.onload = () => {
          this.svgIcon = this.svgImage; // Mark as ready once loaded
        };
      }

      this.createdAt = Date.now();
      this.direction = direction;
    }

    draw(context) {
      const { x, y } = this.position;
      const { x: radiusX, y: radiusY } = this.radius;
      const scale = window.devicePixelRatio;

      if (this.svgIcon) {
        context.save();
        context.translate(scale * x, scale * y);
        context.rotate(this.emojiRotationAngle);
        context.drawImage(this.svgIcon, -radiusX, -radiusY, radiusX * 2, radiusY * 2);
        context.restore();
      } else if (this.color) {
        context.fillStyle = this.color;
        context.beginPath();
        context.ellipse(x * scale, y * scale, radiusX * scale, radiusY * scale, this.rotationAngle, 0, 2 * Math.PI);
        context.fill();
      } else if (this.emoji) {
        context.font = `${radiusX * scale}px serif`;
        context.save();
        context.translate(scale * x, scale * y);
        context.rotate(this.emojiRotationAngle);
        context.textAlign = "center";
        context.fillText(this.emoji, 0, radiusY / 2); // Adjust vertical alignment
        context.restore();
      }
    }

    updatePosition(deltaTime, currentTime) {
      const elapsed = currentTime - this.createdAt;

      if (this.speed.x > this.finalSpeedX) {
        this.speed.x -= this.dragCoefficient * deltaTime;
      }

      this.position.x += this.speed.x * (this.direction === "left" ? -this.absCos : this.absCos) * deltaTime;
      this.position.y = this.initialPosition.y - this.speed.y * this.absSin * elapsed + 0.00125 * Math.pow(elapsed, 2) / 2;

      if (!this.emoji && !this.svgIcon) {
        this.rotationSpeed -= 1e-5 * deltaTime;
        this.rotationSpeed = Math.max(this.rotationSpeed, 0);

        if (this.radiusYDirection === "down") {
          this.radius.y -= deltaTime * this.rotationSpeed;
          if (this.radius.y <= 0) {
            this.radius.y = 0;
            this.radiusYDirection = "up";
          }
        } else {
          this.radius.y += deltaTime * this.rotationSpeed;
          if (this.radius.y >= this.initialRadius) {
            this.radius.y = this.initialRadius;
            this.radiusYDirection = "down";
          }
        }
      }
    }

    isVisible(canvasHeight) {
      return this.position.y < canvasHeight + 100;
    }
  }

  class ConfettiManager {
    constructor() {
      this.canvas = document.createElement("canvas");
      this.canvas.style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1000; pointer-events: none;";
      document.body.appendChild(this.canvas);
      this.context = this.canvas.getContext("2d");
      this.confetti = [];
      this.lastUpdated = Date.now();
      window.addEventListener("resize", Utils.debounce(() => this.resizeCanvas(), 200));
      this.resizeCanvas();
      requestAnimationFrame(() => this.loop());
    }

    resizeCanvas() {
      this.canvas.width = window.innerWidth * window.devicePixelRatio;
      this.canvas.height = window.innerHeight * window.devicePixelRatio;
    }

    addConfetti(config = {}) {
      const { confettiesNumber, confettiRadius, confettiColors, emojies, svgIcon } = {
        ...defaultConfettiConfig,
        ...config,
      };

      const baseY = (5 * window.innerHeight) / 7;
      for (let i = 0; i < confettiesNumber / 2; i++) {
        this.confetti.push(new Confetti({
          initialPosition: { x: 0, y: baseY },
          direction: "right",
          radius: confettiRadius,
          colors: confettiColors,
          emojis: emojies,
          svgIcon,
        }));
        this.confetti.push(new Confetti({
          initialPosition: { x: window.innerWidth, y: baseY },
          direction: "left",
          radius: confettiRadius,
          colors: confettiColors,
          emojis: emojies,
          svgIcon,
        }));
      }
    }

    resetAndStart(config = {}) {
      // Clear existing confetti
      this.confetti = [];
      // Add new confetti
      this.addConfetti(config);
    }

    loop() {
      const currentTime = Date.now();
      const deltaTime = currentTime - this.lastUpdated;
      this.lastUpdated = currentTime;

      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.confetti = this.confetti.filter((item) => {
        item.updatePosition(deltaTime, currentTime);
        item.draw(this.context);
        return item.isVisible(this.canvas.height);
      });

      requestAnimationFrame(() => this.loop());
    }

    addConfettiIntervalDelay() {
      setTimeout(() => {
          console.log("Delay between confetti");
        }, 10000); // units are ms
    }
  }

  class BackgroundConfetti {
      constructor(){}

      enableBackgroundConfetti(){
          // Globals
          var random = Math.random
          , cos = Math.cos
          , sin = Math.sin
          , PI = Math.PI
          , PI2 = PI * 2
          , timer = undefined
          , frame = undefined
          , confetti = [];

          var particles = 10
          , spread = 40
          , sizeMin = 3
          , sizeMax = 12 - sizeMin
          , eccentricity = 10
          , deviation = 100
          , dxThetaMin = -.1
          , dxThetaMax = -dxThetaMin - dxThetaMin
          , dyMin = .13
          , dyMax = .18
          , dThetaMin = .4
          , dThetaMax = .7 - dThetaMin;

          var colorThemes = [
              function() {
                  return color(200 * random()|0, 200 * random()|0, 200 * random()|0);
              },
              function() {
                  var black = 200 * random()|0; return color(200, black, black);
              },
              function() {
                  var black = 200 * random()|0; return color(black, 200, black);
              },
              function() {
                  var black = 200 * random()|0; return color(black, black, 200);
              },
              function() {
                  return color(200, 100, 200 * random()|0);
              },
              function() {
                  return color(200 * random()|0, 200, 200);
              }, 
              function() {
                  var black = 256 * random()|0; return color(black, black, black);
              }, 
              function() {
                  return colorThemes[random() < .5 ? 1 : 2]();
              }, 
              function() {
                  return colorThemes[random() < .5 ? 3 : 5]();
              }, 
              function() {
                  return colorThemes[random() < .5 ? 2 : 4]();
              }
          ];
          function color(r, g, b) {
          return 'rgb(' + r + ',' + g + ',' + b + ')';
          }

          // Cosine interpolation
          function interpolation(a, b, t) {
          return (1-cos(PI*t))/2 * (b-a) + a;
          }

          // Create a 1D Maximal Poisson Disc over [0, 1]
          var radius = 1/eccentricity, radius2 = radius+radius;
          function createPoisson() {
          // domain is the set of points which are still available to pick from
          // D = union{ [d_i, d_i+1] | i is even }
          var domain = [radius, 1-radius], measure = 1-radius2, spline = [0, 1];
          while (measure) {
          var dart = measure * random(), i, l, interval, a, b, c, d;

          // Find where dart lies
          for (i = 0, l = domain.length, measure = 0; i < l; i += 2) {
              a = domain[i], b = domain[i+1], interval = b-a;
              if (dart < measure+interval) {
              spline.push(dart += a-measure);
              break;
              }
              measure += interval;
          }
          c = dart-radius, d = dart+radius;

          // Update the domain
          for (i = domain.length-1; i > 0; i -= 2) {
              l = i-1, a = domain[l], b = domain[i];
              // c---d          c---d  Do nothing
              //   c-----d  c-----d    Move interior
              //   c--------------d    Delete interval
              //         c--d          Split interval
              //       a------b
              if (a >= c && a < d)
              if (b > d) domain[l] = d; // Move interior (Left case)
              else domain.splice(l, 2); // Delete interval
              else if (a < c && b > c)
              if (b <= d) domain[i] = c; // Move interior (Right case)
              else domain.splice(i, 0, c, d); // Split interval
          }

          // Re-measure the domain
          for (i = 0, l = domain.length, measure = 0; i < l; i += 2)
              measure += domain[i+1]-domain[i];
          }

          return spline.sort();
          }

          // Create the overarching container
          var container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.top      = '0';
          container.style.left     = '0';
          container.style.width    = '100%';
          container.style.height   = '0';
          container.style.overflow = 'visible';
          container.style.zIndex   = '9999';

          // Confetto constructor
          function Confetto(theme) {
          this.frame = 0;
          this.outer = document.createElement('div');
          this.inner = document.createElement('div');
          this.outer.appendChild(this.inner);

          var outerStyle = this.outer.style, innerStyle = this.inner.style;
          outerStyle.position = 'absolute';
          outerStyle.width  = (sizeMin + sizeMax * random()) + 'px';
          outerStyle.height = (sizeMin + sizeMax * random()) + 'px';
          innerStyle.width  = '100%';
          innerStyle.height = '100%';
          innerStyle.backgroundColor = theme();

          outerStyle.perspective = '50px';
          outerStyle.transform = 'rotate(' + (360 * random()) + 'deg)';
          this.axis = 'rotate3D(' +
          cos(360 * random()) + ',' +
          cos(360 * random()) + ',0,';
          this.theta = 360 * random();
          this.dTheta = dThetaMin + dThetaMax * random();
          innerStyle.transform = this.axis + this.theta + 'deg)';

          this.x = window.innerWidth * random();
          this.y = -deviation;
          this.dx = sin(dxThetaMin + dxThetaMax * random());
          this.dy = dyMin + dyMax * random();
          outerStyle.left = this.x + 'px';
          outerStyle.top  = this.y + 'px';

          // Create the periodic spline
          this.splineX = createPoisson();
          this.splineY = [];
          for (var i = 1, l = this.splineX.length-1; i < l; ++i)
          this.splineY[i] = deviation * random();
          this.splineY[0] = this.splineY[l] = deviation * random();

          this.update = function(height, delta) {
          this.frame += delta;
          this.x += this.dx * delta;
          this.y += this.dy * delta;
          this.theta += this.dTheta * delta;

          // Compute spline and convert to polar
          var phi = this.frame % 7777 / 7777, i = 0, j = 1;
          while (phi >= this.splineX[j]) i = j++;
          var rho = interpolation(
              this.splineY[i],
              this.splineY[j],
              (phi-this.splineX[i]) / (this.splineX[j]-this.splineX[i])
          );
          phi *= PI2;

          outerStyle.left = this.x + rho * cos(phi) + 'px';
          outerStyle.top  = this.y + rho * sin(phi) + 'px';
          innerStyle.transform = this.axis + this.theta + 'deg)';
          return this.y > height+deviation;
          };
          }

          function poof() {
          if (!frame) {
          // Append the container
          document.body.appendChild(container);

          // Add confetti
          var theme = colorThemes[0]
              , count = 0;
          (function addConfetto() {
              var confetto = new Confetto(theme);
              confetti.push(confetto);
              container.appendChild(confetto.outer);
              timer = setTimeout(addConfetto, spread * random());
          })(0);

          // Start the loop
          var prev = undefined;
          requestAnimationFrame(function loop(timestamp) {
              var delta = prev ? timestamp - prev : 0;
              prev = timestamp;
              var height = window.innerHeight;

              for (var i = confetti.length-1; i >= 0; --i) {
              if (confetti[i].update(height, delta)) {
                  container.removeChild(confetti[i].outer);
                  confetti.splice(i, 1);
              }
              }

              if (timer || confetti.length)
              return frame = requestAnimationFrame(loop);

              // Cleanup
              document.body.removeChild(container);
              frame = undefined;
          });
          }
          }

          poof();
      }
  }

  // Main code execution
  // Start: Code for access page
  var submitBtnElem = document.getElementById("submit-btn");

  // on click event handler for submit btn
  submitBtnElem.onclick = function(){
    // Read input from pwd input
    var pwdEntered = document.getElementById("pwd-input").value;
    if (pwdEntered == 'juju')
    {
      console.log("Correct pwd");
      // Remove access content
      $("#access-div").fadeOut(400);
      // Show bday content
      $("#bday-div").delay(500).fadeIn(400);
      // Play music and show confetti
      document.getElementById("my_audio")
        .play()
        .then(() => {
          const manager = new ConfettiManager();
          const bgConfetti = new BackgroundConfetti();
          // Show BG confetti
          manager.addConfetti();
          bgConfetti.enableBackgroundConfetti();
        })
        .catch((error) => {
          console.log("Unable to play the video, User has not interacted yet.");
        });
    }
    else {
      alert("Incorrect pwd. Please try again.");
    }
  }
  // End: Code for access page

  // Start: Code for bday content
  
  

  // const triggerButton = $("show-again");
  // if (triggerButton) {
  //   triggerButton.addEventListener("click", () => manager.addConfetti());
  //   // Play audio on page load
  //   let playAttempt = setInterval(() => {
  //     document.getElementById("my_audio")
  //       .play()
  //       .then(() => {
  //         clearInterval(playAttempt);
  //         // Show BG confetti
  //         bgConfetti.enableBackgroundConfetti();
  //       })
  //       .catch((error) => {
  //         console.log("Unable to play the video, User has not interacted yet.");
  //       });
  //   }, 1000);
  // }

  const resetInput = document.getElementById("reset");
  if (resetInput) {
    resetInput.addEventListener("input", () => manager.resetAndStart());
  }
  // End: Code for bday content
})();
