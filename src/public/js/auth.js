document.addEventListener('DOMContentLoaded', () => {
  const signinForm = document.getElementById('signin-form')
  const signupForm = document.getElementById('signup-form')
  const signinErrorMessage = document.getElementById('signin-error-message')
  const signupErrorMessage = document.getElementById('signup-error-message')

  signinForm.addEventListener('submit', async event => {
    event.preventDefault()
    await submitForm(signinForm, '/api/auth/signin', signinErrorMessage)
  })

  signupForm.addEventListener('submit', async event => {
    event.preventDefault()
    await submitForm(signupForm, '/api/auth/signup', signupErrorMessage)
  })

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
})

function toggleCreateAccount () {
  const createAccountContainer = document.getElementById(
    'create-account-container'
  )
  createAccountContainer.classList.toggle('hidden')
}
