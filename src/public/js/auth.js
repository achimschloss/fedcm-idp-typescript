const { browserSupportsWebAuthn, startRegistration, startAuthentication } =
  SimpleWebAuthnBrowser

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
      await submitForm(signinForm, '/api/auth/signin', signinErrorMessage)
    } else {
      await startPassKeyAuthentication(signinForm, signinErrorMessage)
    }
  })

  signupForm.addEventListener('submit', async event => {
    event.preventDefault()
    const submitType = event.submitter.getAttribute('submit-type')
    if (submitType === 'password') {
      await submitForm(signupForm, '/api/auth/signup', signupErrorMessage)
    } else if (submitType === 'passkey') {
      startPassKeyRegistration(signupForm, signupErrorMessage)
    } else {
      // Handle other form submissions
    }
  })
})

async function startPassKeyRegistration (form, errorMessage) {
  const formData = new FormData(form)
  const resp = await fetch('api/auth/generate-registration-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData))
  })
  const attResp = resp.ok ? await startRegistration(await resp.json()) : null
  if (!attResp) {
    errorMessage.textContent = await resp.text()
    errorMessage.classList.remove('hidden')
    return
  }
  const verificationResp = await fetch('api/auth/verify-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attResp)
  })
  const verificationJSON = await verificationResp.json()
  if (verificationJSON && verificationJSON.verified) {
    if (window.IdentityProvider && IdentityProvider.close) {
      try {
        IdentityProvider.close()
      } catch (e) {}
    }
    location.reload()
  } else {
    errorMessage.textContent = verificationJSON.error
    errorMessage.classList.remove('hidden')
  }
}

async function startPassKeyAuthentication (form, errorMessage) {
  const formData = new FormData(form)
  const resp = await fetch('api/auth/generate-authentication-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData))
  })
  const asseResp = await startAuthentication(await resp.json())
  const verificationResp = await fetch('/api/auth/verify-authentication', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asseResp)
  })
  const verificationJSON = await verificationResp.json()
  if (verificationJSON && verificationJSON.verified) {
    if (window.IdentityProvider && IdentityProvider.close) {
      try {
        IdentityProvider.close()
      } catch (e) {}
    }
    location.reload()
  } else {
    errorMessage.textContent = verificationJSON.error
    errorMessage.classList.remove('hidden')
  }
}

async function submitForm (form, url, errorMessage) {
  const formData = new FormData(form)

  // Construct the base URL based on the current location
  const baseURL = `${location.protocol}//${location.hostname}:${location.port}`

  try {
    const response = await fetch(`${baseURL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(Object.fromEntries(formData))
    })

    if (response.ok) {
      // In case this view is embedded in an FedCM Sign-Dialog, close it via the IdentityProvider API
      if (window.IdentityProvider && IdentityProvider.close) {
        try {
          // Close the Sign-Dialog
          IdentityProvider.close()
        } catch (e) {
          // Ignore the exception
          console.info(
            '`IdentityProvider.close()` was called but not in effect.'
          )
        }
      }
      location.reload()
    } else {
      const errorText = await response.text()
      errorMessage.textContent = errorText
      errorMessage.classList.remove('hidden')
    }
  } catch (error) {
    errorMessage.textContent = 'An error occurred. Please try again.'
    errorMessage.classList.remove('hidden')
  }
}

function toggleCreateAccount () {
  const createAccountContainer = document.getElementById(
    'create-account-container'
  )
  createAccountContainer.classList.toggle('hidden')
}

console.log('auth.js loaded')
fetch('/api/auth/generate-authentication-options', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
  .then(resp => resp.json())
  .then(opts => {
    console.log('Authentication Options (Autofill)', opts)
    startAuthentication(opts, true)
      .then(async asseResp => {
        const verificationResp = await fetch(
          '/api/auth/verify-authentication',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asseResp)
          }
        )
        const verificationJSON = await verificationResp.json()
        console.log('Verification (Autofill)', verificationJSON)
        if (verificationJSON && verificationJSON.verified) {
          if (window.IdentityProvider && IdentityProvider.close) {
            try {
              IdentityProvider.close()
            } catch (e) {}
          }
          location.reload()
        } else {
          const errorMessage = document.getElementById('signin-error-message')
          errorMessage.textContent = verificationJSON.error
          errorMessage.classList.remove('hidden')
        }
      })
      .catch(err => console.error('(Autofill)', err))
  })
