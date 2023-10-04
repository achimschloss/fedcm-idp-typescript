const authorizeForm = document.getElementById('authorize-form')
const rejectForm = document.getElementById('reject-form')

function submit (form, path) {
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
        response.text().then(result => {
          handleSuccess(result)
        })
      }
    })
    .catch(err => handleError(err))
}

function handleSuccess (token) {
  console.log(token)
  const response = '--fake-token-from-pop-up-window--'
  IdentityProvider.resolve(response)
}

function handleError (err) {
  console.log(err)
}

const handleFormSubmission = event => {
  event.preventDefault()
  const formData = new FormData(event.target)
  const clientId = formData.get('client_id')
  const scope = formData.get('scope')
  if (event.target === authorizeForm) {
    // Handle the authorize form submission
    console.log(`Client ${clientId} authorized for scope ${scope}`)
    submit(authorizeForm, '/fedcm/authorize_endpoint')
  } else if (event.target === rejectForm) {
    // Directly resolve with error message
    console.log(`Client ${clientId} rejected for scope ${scope}`)
    IdentityProvider.resolve(JSON.stringify({ error: 'permission_denied' }))
  }
}

authorizeForm.addEventListener('submit', handleFormSubmission)
rejectForm.addEventListener('submit', handleFormSubmission)
