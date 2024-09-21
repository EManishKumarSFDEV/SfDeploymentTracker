import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronUp, PlusCircle, Trash2, FileText, FileCode, File, Calendar, Filter, Copy, X } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

type FieldChange = {
  date: string
  apiName: string
  label: string
  fieldType: string
  note: string
}

type LWCChange = {
  date: string
  componentName: string
  fileType: string
  code?: string
  note: string
}

type ProfileChange = {
  date: string
  profile: string
  note: string
}

type PermissionChange = {
  date: string
  permissionSet: string
  permission: string
  access: {
    read: boolean
    write: boolean
  }
  note: string
}

type Change = {
  id: string
  type: 'Field' | 'LWC' | 'Profile' | 'Permission'
  details: FieldChange | LWCChange | ProfileChange | PermissionChange
}

type UserStory = {
  id: string
  userId: string
  number: string
  title: string
  description: string
  date: string
  changes: Change[]
}

type User = {
  id: string
  email?: string | undefined
}

export default function Component() {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userStories, setUserStories] = useState<UserStory[]>([])
  const [newStoryExpanded, setNewStoryExpanded] = useState(false)
  const [newStoryNumber, setNewStoryNumber] = useState('')
  const [newStoryTitle, setNewStoryTitle] = useState('')
  const [newStoryDescription, setNewStoryDescription] = useState('')
  const [newStoryDate, setNewStoryDate] = useState('')
  const [expandedStories, setExpandedStories] = useState<string[]>([])
  const [filterNumber, setFilterNumber] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [errorMessage, setErrorMessage] = useState('')
  const storiesPerPage = 10

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    checkUser()
  }, [])

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user
      setCurrentUser(currentUser ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const fetchUserStories = useCallback(async () => {
    if (!currentUser) return
    const { data, error } = await supabase
      .from('user_stories')
      .select('*')
      .eq('userId', currentUser.id)
    if (error) {
      console.error('Error fetching user stories:', error)
    } else {
      setUserStories(data)
    }
  }, [currentUser])

  useEffect(() => {
    if (currentUser) {
      fetchUserStories()
    }
  }, [currentUser, fetchUserStories])

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) setErrorMessage('Check your email for the confirmation link.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('An unknown error occurred')
      }
    }
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setErrorMessage(error.message)
    }
  }

  const addUserStory = async () => {
    if (!currentUser) return
    if (newStoryTitle.trim() === '' || newStoryDate === '' || newStoryNumber.trim() === '') {
      setErrorMessage('Please fill in all required fields for the new user story.')
      return
    }

    const newStory: Omit<UserStory, 'id'> = {
      userId: currentUser.id,
      number: newStoryNumber,
      title: newStoryTitle,
      description: newStoryDescription,
      date: newStoryDate,
      changes: []
    }

    const { data, error } = await supabase
      .from('user_stories')
      .insert([newStory])
      .select()

    if (error) {
      setErrorMessage('Error adding user story')
    } else {
      setUserStories(prevStories => [...prevStories, data[0]])
      setNewStoryNumber('')
      setNewStoryTitle('')
      setNewStoryDescription('')
      setNewStoryDate('')
      setNewStoryExpanded(false)
    }
  }

  const removeUserStory = async (id: string) => {
    const { error } = await supabase
      .from('user_stories')
      .delete()
      .eq('id', id)

    if (error) {
      setErrorMessage('Error removing user story')
    } else {
      setUserStories(prevStories => prevStories.filter(story => story.id !== id))
      setExpandedStories(prevExpanded => prevExpanded.filter(storyId => storyId !== id))
    }
  }

  const addChange = async (storyId: string, changeType: Change['type'], changeDetails: Change['details']) => {
    const { data, error } = await supabase
      .from('user_stories')
      .select('changes')
      .eq('id', storyId)
      .single()

    if (error) {
      setErrorMessage('Error fetching user story')
      return
    }

    const updatedChanges = [...data.changes, { id: Date.now().toString(), type: changeType, details: changeDetails }]

    const { error: updateError } = await supabase
      .from('user_stories')
      .update({ changes: updatedChanges })
      .eq('id', storyId)

    if (updateError) {
      setErrorMessage('Error adding change')
    } else {
      setUserStories(prevStories => prevStories.map(story => 
        story.id === storyId ? { ...story, changes: updatedChanges } : story
      ))
    }
  }

  const removeChange = async (storyId: string, changeId: string) => {
    const { data, error } = await supabase
      .from('user_stories')
      .select('changes')
      .eq('id', storyId)
      .single()

    if (error) {
      setErrorMessage('Error fetching user story')
      return
    }

    const updatedChanges = data.changes.filter((change: Change) => change.id !== changeId)

    const { error: updateError } = await supabase
      .from('user_stories')
      .update({ changes: updatedChanges })
      .eq('id', storyId)

    if (updateError) {
      setErrorMessage('Error removing change')
    } else {
      setUserStories(prevStories => prevStories.map(story => 
        story.id === storyId ? { ...story, changes: updatedChanges } : story
      ))
    }
  }

  const toggleStoryExpansion = (storyId: string) => {
    setExpandedStories(prev =>
      prev.includes(storyId)
        ? prev.filter(id => id !== storyId)
        : [...prev, storyId]
    )
  }

  const filteredStories = userStories.filter(story => {
    const matchesNumber = filterNumber ? story.number.includes(filterNumber) : true
    return matchesNumber
  })

  const indexOfLastStory = currentPage * storiesPerPage
  const indexOfFirstStory = indexOfLastStory - storiesPerPage
  const currentStories = filteredStories.slice(indexOfFirstStory, indexOfLastStory)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>{isRegistering ? 'Register' : 'Login'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthentication} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {isRegistering ? 'Register' : 'Login'}
              </Button>
            </form>
            <p className="text-center mt-4">
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              <Button variant="link" onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? 'Login' : 'Register'}
              </Button>
            </p>
          </CardContent>
        </Card>
        {errorMessage && (
          <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
            {errorMessage}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {errorMessage && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
          {errorMessage}
        </div>
      )}
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-blue-700">Salesforce Deployment Tracker</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Welcome, {currentUser.email}</span>
            <Button onClick={handleLogout}>Logout</Button>
          </div>
        </div>
        
        <Card className="mb-8 shadow-lg bg-white">
          <CardHeader className="bg-blue-500 text-white cursor-pointer" onClick={() => setNewStoryExpanded(!newStoryExpanded)}>
            <CardTitle className="flex justify-between items-center">
              <span>Add New User Story</span>
              {newStoryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
          {newStoryExpanded && (
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <Input
                    placeholder="User Story Number"
                    value={newStoryNumber}
                    onChange={(e) => setNewStoryNumber(e.target.value)}
                    className="flex-grow"
                  />
                  <Input
                    placeholder="User Story Title"
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    className="flex-grow"
                  />
                  <Input
                    type="date"
                    value={newStoryDate}
                    onChange={(e) => setNewStoryDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Textarea
                  placeholder="User Story Description"
                  value={newStoryDescription}
                  onChange={(e) => setNewStoryDescription(e.target.value)}
                />
                <Button onClick={addUserStory} className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add User Story
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="mb-8 shadow-lg bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-blue-500" />
              <Input
                placeholder="Filter by Story Number"
                value={filterNumber}
                onChange={(e) => setFilterNumber(e.target.value)}
                className="flex-grow"
              />
            </div>
          </CardContent>
        </Card>

        {currentStories.map(story => (
          <Card key={story.id} className="mb-6 shadow-md bg-white">
            <CardHeader className="bg-blue-100 cursor-pointer" onClick={() => toggleStoryExpansion(story.id)}>
              <CardTitle className="flex justify-between items-center">
                <span className="text-blue-700">#{story.number} - {story.title}</span>
                <div className="flex items-center">
                  <span className="text-sm text-blue-600 mr-4">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    {story.date}
                  </span>
                  <Button variant="ghost" size="sm" className="text-blue-600">
                    {expandedStories.includes(story.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); removeUserStory(story.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            {expandedStories.includes(story.id) && (
              <CardContent>
                <p className="mb-4 text-gray-600">{story.description}</p>
                <h3 className="font-semibold mb-2 text-blue-700">Changes:</h3>
                <ChangeForm storyId={story.id} addChange={addChange} setErrorMessage={setErrorMessage} />
                <div className="space-y-2 mt-4">
                  {story.changes.map(change => (
                    <ChangeDisplay key={change.id} change={change} onRemove={() => removeChange(story.id, change.id)} />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}

        {filteredStories.length > storiesPerPage && (
          <div className="flex justify-center mt-4">
            {Array.from({ length: Math.ceil(filteredStories.length / storiesPerPage) }, (_, i) => (
              <Button
                key={i}
                onClick={() => paginate(i + 1)}
                className={`mx-1 ${currentPage === i + 1 ? 'bg-blue-500 text-white' : 'bg-white text-blue-500'}`}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChangeForm({ storyId, addChange, setErrorMessage }: { storyId: string, addChange: (storyId: string, changeType: Change['type'], changeDetails: Change['details']) => void, setErrorMessage: (message: string) => void }) {
  const [changeType, setChangeType] = useState<Change['type']>('Field')
  const [date, setDate] = useState('')
  const [fieldApiName, setFieldApiName] = useState('')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState('')
  const [lwcComponentName, setLwcComponentName] = useState('')
  const [lwcFileType, setLwcFileType] = useState('')
  const [lwcCode, setLwcCode] = useState('')
  const [profile, setProfile] = useState('')
  const [permissionSet, setPermissionSet] = useState('')
  const [permission, setPermission] = useState('')
  const [readAccess, setReadAccess] = useState(false)
  const [writeAccess, setWriteAccess] = useState(false)
  const [note, setNote] = useState('')

  const handleAddChange = () => {
    if (!date) {
      setErrorMessage('Please select a date for the change.')
      return
    }

    let changeDetails: Change['details']

    switch (changeType) {
      case 'Field':
        if (!fieldApiName || !fieldLabel || !fieldType) {
          setErrorMessage('Please fill in all required fields for Field Change.')
          return
        }
        changeDetails = { date, apiName: fieldApiName, label: fieldLabel, fieldType, note } as FieldChange
        break
      case 'LWC':
        if (!lwcComponentName || !lwcFileType) {
          setErrorMessage('Please fill in all required fields for LWC Change.')
          return
        }
        changeDetails = { date, componentName: lwcComponentName, fileType: lwcFileType, code: lwcCode, note } as LWCChange
        break
      case 'Profile':
        if (!profile) {
          setErrorMessage('Please enter a profile name.')
          return
        }
        changeDetails = { date, profile, note } as ProfileChange
        break
      case 'Permission':
        if (!permissionSet || !permission) {
          setErrorMessage('Please fill in all required fields for Permission Change.')
          return
        }
        changeDetails = { date, permissionSet, permission, access: { read: readAccess, write: writeAccess }, note } as PermissionChange
        break
      default:
        setErrorMessage('Invalid change type.')
        return
    }

    addChange(storyId, changeType, changeDetails)

    // Reset form fields
    setDate('')
    setFieldApiName('')
    setFieldLabel('')
    setFieldType('')
    setLwcComponentName('')
    setLwcFileType('')
    setLwcCode('')
    setProfile('')
    setPermissionSet('')
    setPermission('')
    setReadAccess(false)
    setWriteAccess(false)
    setNote('')
  }

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Select value={changeType} onValueChange={(value: Change['type']) => setChangeType(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Change Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Field">Field Creation</SelectItem>
            <SelectItem value="LWC">LWC Change</SelectItem>
            <SelectItem value="Profile">Profile Change</SelectItem>
            <SelectItem value="Permission">Permission Change</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
      </div>

      {changeType === 'Field' && (
        <div className="space-y-2">
          <Input placeholder="Field API Name" value={fieldApiName} onChange={(e) => setFieldApiName(e.target.value)} />
          <Input placeholder="Field Label" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} />
          <Select value={fieldType} onValueChange={setFieldType}>
            <SelectTrigger>
              <SelectValue placeholder="Field Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Text">Text</SelectItem>
              <SelectItem value="Number">Number</SelectItem>
              <SelectItem value="Date">Date</SelectItem>
              <SelectItem value="Checkbox">Checkbox</SelectItem>
              <SelectItem value="Picklist">Picklist</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {changeType === 'LWC' && (
        <div className="space-y-2">
          <Input placeholder="Component Name" value={lwcComponentName} onChange={(e) => setLwcComponentName(e.target.value)} />
          <Select value={lwcFileType} onValueChange={setLwcFileType}>
            <SelectTrigger>
              <SelectValue placeholder="File Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="js">JS</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Enter code (optional)" value={lwcCode} onChange={(e) => setLwcCode(e.target.value)} />
        </div>
      )}

      {changeType === 'Profile' && (
        <div className="space-y-2">
          <Input placeholder="Profile Name" value={profile} onChange={(e) => setProfile(e.target.value)} />
        </div>
      )}

      {changeType === 'Permission' && (
        <div className="space-y-2">
          <Input placeholder="Permission Set" value={permissionSet} onChange={(e) => setPermissionSet(e.target.value)} />
          <Input placeholder="Permission" value={permission} onChange={(e) => setPermission(e.target.value)} />
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="read"
                checked={readAccess}
                onCheckedChange={(checked) => setReadAccess(checked === true)}
              />
              <Label htmlFor="read">Read Access</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="write"
                checked={writeAccess}
                onCheckedChange={(checked) => setWriteAccess(checked === true)}
              />
              <Label htmlFor="write">Write Access</Label>
            </div>
          </div>
        </div>
      )}

      <Textarea placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />

      <Button onClick={handleAddChange} className="w-full bg-blue-500 hover:bg-blue-600 text-white">
        <PlusCircle className="h-4 w-4 mr-2" />
        Add Change
      </Button>
    </div>
  )
}

function ChangeDisplay({ change, onRemove }: { change: Change, onRemove: () => void }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  const renderIcon = (changeType: string) => {
    switch (changeType) {
      case 'Field':
        return <FileText className="h-4 w-4 mr-2" />
      case 'LWC':
        return <FileCode className="h-4 w-4 mr-2" />
      case 'Profile':
      case 'Permission':
        return <File className="h-4 w-4 mr-2" />
      default:
        return <File className="h-4 w-4 mr-2" />
    }
  }

  const copyCode = () => {
    if (codeRef.current) {
      navigator.clipboard.writeText(codeRef.current.textContent || '')
    }
  }

  const getLanguage = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'html':
        return 'html'
      case 'js':
        return 'javascript'
      case 'css':
        return 'css'
      case 'xml':
        return 'xml'
      default:
        return 'javascript'
    }
  }

  return (
    <div className="flex justify-between items-start bg-blue-50 p-3 rounded-lg">
      <div className="flex items-start">
        {renderIcon(change.type)}
        <div>
          <span className="font-semibold text-blue-700">{change.type}: </span>
          {change.type === 'Field' && (
            <div className="text-sm text-gray-600">
              <p>Date: {(change.details as FieldChange).date}</p>
              <p>API Name: {(change.details as FieldChange).apiName}</p>
              <p>Label: {(change.details as FieldChange).label}</p>
              <p>Type: {(change.details as FieldChange).fieldType}</p>
              <p>Note: {(change.details as FieldChange).note}</p>
            </div>
          )}
          {change.type === 'LWC' && (
            <div className="text-sm text-gray-600">
              <p>Date: {(change.details as LWCChange).date}</p>
              <p>
                {(change.details as LWCChange).code ? (
                  <span
                    className="cursor-pointer text-blue-600 hover:underline"
                    onClick={() => setIsPopupOpen(true)}
                  >
                    {(change.details as LWCChange).componentName}.{(change.details as LWCChange).fileType}
                  </span>
                ) : (
                  <span>{(change.details as LWCChange).componentName}.{(change.details as LWCChange).fileType}</span>
                )}
              </p>
              <p>Note: {(change.details as LWCChange).note}</p>
            </div>
          )}
          {change.type === 'Profile' && (
            <div className="text-sm text-gray-600">
              <p>Date: {(change.details as ProfileChange).date}</p>
              <p>Profile: {(change.details as ProfileChange).profile}</p>
              <p>Note: {(change.details as ProfileChange).note}</p>
            </div>
          )}
          {change.type === 'Permission' && (
            <div className="text-sm text-gray-600">
              <p>Date: {(change.details as PermissionChange).date}</p>
              <p>Permission Set: {(change.details as PermissionChange).permissionSet}</p>
              <p>Permission: {(change.details as PermissionChange).permission}</p>
              <p>Access: {(change.details as PermissionChange).access.read ? 'Read' : ''} {(change.details as PermissionChange).access.write ? 'Write' : ''}</p>
              <p>Note: {(change.details as PermissionChange).note}</p>
            </div>
          )}
        </div>
      </div>
      <Button variant="destructive" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
      {isPopupOpen && change.type === 'LWC' && (change.details as LWCChange).code && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-11/12 h-5/6 max-w-4xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Code Preview</h3>
              <div>
                <Button variant="outline" size="sm" className="mr-2" onClick={copyCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsPopupOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-grow overflow-auto">
              <SyntaxHighlighter
                language={getLanguage((change.details as LWCChange).fileType)}
                style={tomorrow}
                customStyle={{ margin: 0, padding: '1rem' }}
                ref={codeRef}
                wrapLines={true}
                wrapLongLines={true}
                showLineNumbers={true}
              >
                {(change.details as LWCChange).code || '// No code available'}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}