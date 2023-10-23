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
  // Resolve with token
  // this will fail on the RP side of the API due to https://bugs.chromium.org/p/chromium/issues/detail?id=1489239
  IdentityProvider.resolve(token)
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
    IdentityProvider.close()
  }
}

authorizeForm.addEventListener('submit', handleFormSubmission)
rejectForm.addEventListener('submit', handleFormSubmission)
