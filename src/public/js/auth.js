const { browserSupportsWebAuthn, startRegistration, startAuthentication } =
  SimpleWebAuthnBrowser

function startPassKeyProcess (type, form, errorDisplay) {
  const formData = new FormData(form)
  let path

  if (type === 'registration') {
    path = '/api/auth/generate-registration-options'
  } else if (type === 'authentication') {
    path = '/api/auth/generate-authentication-options'
  } else {
    handleError('Invalid type', errorDisplay)
    return
  }

  fetch(`${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData))
  })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => Promise.reject(text))
      } else {
        return response.json().then(options => {
          if (type === 'registration') {
            return startRegistration(options)
          } else if (type === 'authentication') {
            return startAuthentication(options)
          }
        })
      }
    })
    .then(webAuthnResponse => verifyPassKey(type, webAuthnResponse))
    .then(() => {
      handleSuccess()
    })
    .catch(err => handleError(err, errorDisplay))
}

function verifyPassKey (type, attResp) {
  let path
  if (type === 'authentication') {
    path = '/api/auth/verify-authentication'
  } else if (type === 'registration') {
    path = '/api/auth/verify-registration'
  }

  return fetch(`${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attResp)
  })
    .then(response => response.json())
    .then(verificationResp => {
      if (verificationResp.verified) {
        return Promise.resolve(verificationResp)
      } else {
        return Promise.reject(verificationResp.error)
      }
    })
}

function submitForm (form, path, errorMessage) {
  const formData = new FormData(form)
  fetch(`${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData))
  })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => Promise.reject(text))
      } else {
        handleSuccess()
      }
    })
    .catch(err => handleError(err, errorMessage))
}

function handleSuccess () {
  // In case were in a FedCM iFrame  - close it
  if (window.IdentityProvider && IdentityProvider.close) {
    try {
      IdentityProvider.close()
    } catch (e) {}
  }
  location.reload()
}

function handleError (error, errorDisplay) {
  // Ignore these errors as they are expected
  if (
    error.name &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  ) {
    console.log(error.message + ' ' + error.name)
  } else {
    errorDisplay.textContent = error
    errorDisplay.classList.remove('hidden')
    console.log('Error:', error)
  }
}

function toggleCreateAccount () {
  const createAccountContainer = document.getElementById(
    'create-account-container'
  )
  createAccountContainer.classList.toggle('hidden')
}

document.addEventListener('DOMContentLoaded', () => {
  const signinForm = document.getElementById('signin-form')
  const signupForm = document.getElementById('signup-form')
  const signinErrorMessage = document.getElementById('signin-error-message')
  const signupErrorMessage = document.getElementById('signup-error-message')
  const passkeyButton = document.getElementById('passkey-button')

  if (!browserSupportsWebAuthn()) {
    passkeyButton.style.display = 'none'
  }

  signinForm.addEventListener('submit', async event => {
    event.preventDefault()
    // Check if the password field is empty
    const passwordField = signinForm.querySelector('input[name="secret"]')
    const password = passwordField.value.trim()
    if (password !== '') {
      submitForm(signinForm, '/api/auth/signin', signinErrorMessage)
    } else {
      startPassKeyProcess('authentication', signinForm, signinErrorMessage)
    }
  })

  signupForm.addEventListener('submit', async event => {
    event.preventDefault()
    const submitType = event.submitter.getAttribute('submit-type')
    if (submitType === 'password') {
      submitForm(signupForm, '/api/auth/signup', signupErrorMessage)
    } else if (submitType === 'passkey') {
      startPassKeyProcess('registration', signupForm, signupErrorMessage)
    } else {
      // Handle other form submissions
    }
  })

  authenticateOnLoad()

  function authenticateOnLoad () {
    fetch('/api/auth/generate-authentication-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => Promise.reject(text))
        } else {
          return response
            .json()
            .then(options => startAuthentication(options, true))
        }
      })
      .then(authResp =>
        verifyPassKey('authentication', authResp, signinErrorMessage)
      )
      .then(() => {
        handleSuccess()
      })
      .catch(err => {
        handleError(err, signinErrorMessage)
      })
  }
})

console.log('auth.js loaded')
