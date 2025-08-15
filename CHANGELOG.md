# 📋 LangFlow Changelog

All notable changes to the LangFlow project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1] 🔧 **Input Variables & Enhanced UX Release**

### 🎉 **Major Features Added**

#### 📥 **Input Variables System**
- **User-Defined Variables**: Create custom input variables like `target_ip`, `domain_name`, `port_range`
- **Template Integration**: Pre-configured variables in workflow templates for common use cases
- **Dynamic Substitution**: Use variables in commands, AI prompts, and report templates
- **Runtime Modification**: Users can modify variable values before workflow execution
- **Validation System**: Comprehensive form validation with real-time feedback and error indicators

#### 🔧 **Enhanced Form Experience**
- **Focus Management**: Fixed input focus issues that prevented smooth typing experience
- **Real-time Validation**: Immediate feedback on form errors with visual indicators
- **Smart Defaults**: New steps come with sensible defaults instead of empty fields
- **Step Completion Tracking**: Visual indicators showing which steps are complete vs. incomplete
- **Form State Optimization**: Functional state updates prevent unnecessary re-renders

#### 📡 **Server-Sent Events (SSE) Implementation**
- **Real-time Updates**: Replaced WebSockets with SSE for better performance and reliability
- **Streaming Logs**: Live execution monitoring with real-time log streaming
- **Connection Health**: Heartbeat monitoring and automatic reconnection
- **Event Types**: Structured events for step progress, logs, errors, and status updates

### 🔧 **Backend Improvements**

#### 🏗️ **New Services & APIs**
- **Streaming Service**: SSE-based real-time communication system
- **Enhanced Workflow Engine**: Support for input variables and dynamic templating
- **Improved Command Executor**: Better playground integration and error handling
- **Event Loop Management**: Proper async handling in multi-threaded environments

#### 📊 **Data Models**
- **Workflow Inputs**: Added `inputs` property to Workflow model for variable storage
- **StreamEvent**: New model for SSE-based real-time communication
- **Enhanced Validation**: Better input validation and sanitization

#### 🛡️ **Security & Stability**
- **Input Sanitization**: Variables are validated and sanitized before execution
- **Error Recovery**: Comprehensive error handling in workflow execution
- **Resource Management**: Better cleanup of execution resources

### 🎨 **Frontend Enhancements**

#### 🖼️ **New UI Components**
- **Enhanced CreateWorkflowPage**: Improved workflow creation with input variables
- **Input Variables Section**: Dedicated UI for managing workflow variables
- **Step Validation Indicators**: Visual feedback for step completion status
- **Form Guidance**: Helpful tips and examples for workflow building

#### 🎯 **UX Improvements**
- **Form Focus Management**: Input fields maintain focus during typing
- **Real-time Validation**: Immediate feedback on form errors
- **Visual Step Status**: Clear indicators for complete vs. incomplete steps
- **Template Integration**: Auto-populate both steps and input variables from templates
- **Better Error Messages**: Clear, actionable error messages with step-specific details

#### 🔄 **State Management**
- **Functional Updates**: Use of functional state updates to prevent focus loss
- **Optimized Re-renders**: Reduced unnecessary component re-renders
- **Better Form Handling**: Improved input change handling and validation

### 📊 **Workflow Templates**

#### 🎯 **Enhanced Templates**
- **Basic Reconnaissance**: `target_domain` variable for subdomain discovery
- **Web Application Testing**: `target_ip` and `target_url` variables for scanning
- **Network Assessment**: `network_range` and `target_hosts` variables for enumeration
- **Custom Workflow**: Blank template for building from scratch

#### 🔧 **Template Features**
- **Pre-configured Variables**: Templates include realistic default values
- **Step Examples**: Real-world security testing workflow examples
- **Variable Integration**: Seamless integration of variables in all step types

### 🐛 **Bug Fixes**

#### 🔧 **Form Input Issues**
- **Fixed Input Focus Loss**: Resolved issue where inputs lost focus after typing one character
- **State Update Optimization**: Fixed unnecessary re-renders causing form instability
- **Validation Errors**: Proper error display and form state management

#### 🏗️ **Backend Fixes**
- **Event Loop Conflicts**: Resolved async/await issues in worker threads
- **Streaming Events**: Fixed broken callback mechanism in real-time updates
- **Workflow Execution**: Ensured run data is properly saved in all scenarios
- **Error Handling**: Better error propagation and user feedback

#### 🎨 **Frontend Fixes**
- **TypeScript Errors**: Resolved all compilation errors and type mismatches
- **Component Props**: Fixed prop type mismatches and interface definitions
- **State Management**: Improved form state handling and validation
- **UI Responsiveness**: Fixed layout issues and improved user experience

### 📈 **Performance Optimizations**

#### ⚡ **System Performance**
- **SSE Implementation**: More efficient real-time communication than WebSockets
- **Form Rendering**: Optimized form updates and reduced re-renders
- **State Management**: Better React state update patterns

#### 🔄 **User Experience**
- **Form Responsiveness**: Smooth typing experience without focus loss
- **Real-time Updates**: Faster and more reliable execution monitoring
- **Template Loading**: Quick template selection and variable population
- **Validation Feedback**: Immediate feedback on form errors

### 🛠️ **Development & Maintenance**

#### 📝 **Documentation**
- **Updated README**: Comprehensive documentation for input variables and enhanced UX
- **API Documentation**: SSE endpoint documentation and event types
- **Usage Examples**: Step-by-step guide for creating dynamic workflows
- **Troubleshooting**: Added section for common form and input issues

#### 🧪 **Testing & Quality**
- **Form Validation**: Comprehensive testing of input validation system
- **State Management**: Testing of form state updates and focus management
- **Template Integration**: Testing of template variable population
- **Error Handling**: Testing of error scenarios and user feedback

### 🔄 **Migration Notes**

#### **From v2.1.0 to v2.2.0**
- **WebSocket to SSE**: Real-time updates now use Server-Sent Events
- **Input Variables**: New workflow creation flow includes variable configuration
- **Form Improvements**: Enhanced form experience with better validation
- **Template Updates**: Templates now include pre-configured input variables

#### **Breaking Changes**
- **Real-time Updates**: Frontend now expects SSE instead of WebSocket connections
- **Workflow Model**: Workflows now include `inputs` property for variables
- **API Endpoints**: New SSE endpoints for real-time execution monitoring

---

## [2.0] 🐳 **Virtual Playground Release**

### 🎉 **Major Features Added**

#### 🐳 **Virtual Playground System**
- **Docker-in-Docker (DIND)** implementation for isolated testing environments
- **Interactive Web Terminal** with full xterm.js integration and Linux shell
- **Pre-installed Security Tools**: nmap, tcpdump, netcat, iptables, curl, wget, git, python3, nodejs
- **Real-time Resource Monitoring**: CPU, memory, network, and disk usage statistics
- **Multi-session Support**: Multiple concurrent terminal sessions per playground instance
- **Automatic Lifecycle Management**: Container creation, monitoring, and cleanup
- **Persistent Workspaces**: Named Docker volumes for data persistence
- **WebSocket-based Communication**: Real-time terminal I/O with proper error handling

#### 🖥️ **Enhanced Terminal Experience**
- **Improved Input Handling**: Fixed double character echo issues
- **Better Connection Management**: Robust WebSocket reconnection with exponential backoff
- **Visual Feedback**: Connection status indicators and countdown timers
- **Keyboard Shortcuts**: F11 (fullscreen), Ctrl+/-/0 (font size), Ctrl+Shift+F (search)
- **Terminal Customization**: Cyberpunk theme with neon colors and custom fonts
- **Session Persistence**: Maintain terminal sessions across page refreshes

### 🔧 **Backend Improvements**

#### 🏗️ **New Services & APIs**
- **PlaygroundService**: Complete Docker container lifecycle management
- **Playground Router**: RESTful API for playground CRUD operations
- **WebSocket Terminal**: Enhanced bidirectional communication with containers
- **Resource Monitoring**: Real-time stats collection for playground instances
- **Orphaned Container Cleanup**: Automatic cleanup of dangling containers and volumes

#### 📊 **Data Models**
- **PlaygroundInstance**: Comprehensive model for playground state management
- **PlaygroundStats**: Resource usage statistics with CPU, memory, network metrics
- **PlaygroundCommand**: Command execution within playground environments
- **PlaygroundTerminalSession**: Session management for terminal connections

#### 🛡️ **Security & Stability**
- **Container Isolation**: Proper security options and resource limits
- **Network Segmentation**: Isolated Docker networks for playground instances
- **Resource Limits**: CPU, memory, and disk usage constraints
- **Session Management**: Secure session handling with timeout controls
- **Error Recovery**: Comprehensive error handling and graceful degradation

### 🎨 **Frontend Enhancements**

#### 🖼️ **New UI Components**
- **PlaygroundPage**: Complete playground management interface
- **PlaygroundTerminal**: Advanced terminal component with xterm.js
- **PlaygroundInstanceCard**: Visual instance status and control cards
- **Resource Monitors**: Real-time charts for playground resource usage

#### 🎯 **UX Improvements**
- **Connection Indicators**: Visual status for WebSocket connections
- **Auto-reconnection**: Smart reconnection with user feedback
- **Loading States**: Proper loading indicators during container initialization
- **Error Messaging**: Clear error messages with actionable solutions
- **Responsive Design**: Mobile-friendly playground interface

### 🔄 **WebSocket Communication**

#### 📡 **Protocol Enhancements**
- **Structured Messaging**: JSON-based message protocol with type safety
- **Bidirectional Communication**: Proper input/output handling for terminals
- **Connection Lifecycle**: Complete connection state management
- **Error Propagation**: Detailed error messages from backend to frontend
- **Keepalive Mechanism**: Ping/pong heartbeat for connection health

#### 🛠️ **Technical Improvements**
- **Buffer Management**: Optimized data buffering for terminal output
- **Unicode Handling**: Proper UTF-8 encoding/decoding for international characters
- **Terminal Resize**: Dynamic terminal dimension updates
- **Session Tracking**: Comprehensive session metadata and activity tracking

### 🗄️ **Data Persistence**

#### 💾 **Storage Enhancements**
- **Playground Persistence**: JSON-based storage for playground instances
- **Session Recovery**: Restore playground state after backend restarts
- **Volume Management**: Named Docker volumes for workspace persistence
- **Cleanup Integration**: Automatic cleanup of expired playground data

### 🐛 **Bug Fixes**

#### 🔧 **Terminal Issues**
- **Fixed Double Echo**: Resolved duplicate character display in terminal
- **WebSocket Stability**: Improved connection reliability and error handling
- **Container Readiness**: Better container health checks before terminal connection
- **Input Processing**: Proper handling of special characters and control sequences

#### 🏗️ **Backend Fixes**
- **Docker API Compatibility**: Removed unsupported timeout parameters
- **Container Status**: Accurate status detection for installing/running states
- **Resource Cleanup**: Proper cleanup of Docker resources on instance deletion
- **Error Handling**: Comprehensive error catching and user-friendly messages

#### 🎨 **Frontend Fixes**
- **TypeScript Errors**: Resolved all compilation errors and type mismatches
- **Component State**: Fixed state management issues in playground components
- **API Integration**: Proper error handling for playground API calls
- **UI Responsiveness**: Fixed layout issues on different screen sizes

### 📈 **Performance Optimizations**

#### ⚡ **System Performance**
- **Async Operations**: Improved async handling for Docker operations
- **Connection Pooling**: Efficient WebSocket connection management
- **Resource Monitoring**: Optimized stats collection with minimal overhead
- **Container Startup**: Faster container initialization with parallel operations

#### 🔄 **User Experience**
- **Loading Times**: Reduced playground creation time from 3+ minutes to 1-2 minutes
- **Terminal Responsiveness**: Improved input/output latency
- **Connection Recovery**: Faster reconnection with reduced delays
- **Status Updates**: Real-time status updates without page refresh

### 🛠️ **Development & Maintenance**

#### 📝 **Documentation**
- **Updated README**: Comprehensive documentation for Virtual Playground features
- **API Documentation**: Complete playground API endpoint documentation
- **Setup Instructions**: Docker requirements and installation guide
- **Usage Examples**: Step-by-step playground usage instructions

#### 🧪 **Testing & Quality**
- **Error Recovery**: Comprehensive error handling tests
- **Connection Stability**: WebSocket connection reliability improvements
- **Container Lifecycle**: Complete testing of playground lifecycle management
- **Resource Management**: Memory and resource leak prevention

---

## [1.5] 🎨 **Major UI/UX Overhaul**

### 🎉 **Major Features**
- **Cyberpunk Theme**: Complete visual redesign with neon colors and dark aesthetics
- **Visual Workflow Builder**: Node-based workflow creation with React Flow
- **Real-time Monitoring**: WebSocket-powered live execution tracking
- **AI-Powered Reports**: ChatGPT integration for professional PDF generation
- **Multi-channel Reporting**: Email, Telegram, and Slack integration

### 🔧 **Backend Improvements**
- **FastAPI Migration**: Complete rewrite from Flask to FastAPI
- **WebSocket Support**: Real-time communication for live updates
- **Async Architecture**: Improved performance with async/await patterns
- **Enhanced Security**: Better input validation and error handling

### 🎨 **Frontend Enhancements**
- **React 18**: Updated to latest React with TypeScript
- **Vite Build System**: Faster development and build processes
- **Tailwind CSS**: Utility-first CSS framework with custom theme
- **Interactive Terminal**: Web-based terminal with xterm.js

---

## [1.0] 🚀 **Initial Release**

### 🎉 **Core Features**
- **Workflow Engine**: Basic workflow execution with command and AI steps
- **OpenAI Integration**: GPT-3.5-turbo and GPT-4 support
- **Command Execution**: Shell command execution with variable templating
- **Basic Reporting**: Simple text-based report generation
- **Web Interface**: Basic React frontend with workflow management

### 🏗️ **Architecture**
- **Python Backend**: Flask-based API server
- **React Frontend**: Basic UI for workflow creation and execution
- **JSON Storage**: File-based data persistence
- **Environment Configuration**: Basic environment variable support

---

## 📋 **Version Schema**

- **Major (X.0.0)**: Breaking changes, major feature additions
- **Minor (X.Y.0)**: New features, backward compatible
- **Patch (X.Y.Z)**: Bug fixes, minor improvements

## 🏷️ **Release Tags**

- 🐳 **Virtual Playground**: Docker integration and containerized environments
- 🎨 **UI/UX**: User interface and experience improvements
- 🤖 **AI**: Artificial intelligence and machine learning features
- 🔧 **Backend**: Server-side improvements and API changes
- 🛡️ **Security**: Security enhancements and vulnerability fixes
- 📊 **Analytics**: Monitoring, metrics, and reporting features
- 🐛 **Bugfix**: Bug fixes and stability improvements

---

*For technical support or feature requests, please create an issue on our GitHub repository.* 