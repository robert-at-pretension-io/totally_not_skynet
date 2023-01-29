# Project goals:
* Make a system that uses a language model, specified user roles and project goals provided as input to create/generate functioning software systems.

# Roles definition
Each of the roles has a defined "perogative" and "obligation" that they must follow. The perogative is the role's ability to do something, and the obligation is the role's responsibility to do something. The perogative and obligation are defined in the following way for each of the roles:

# Roles
* **Developer** - The developer is responsible for writing the code for the system. The developer's perogative is to write code, and the developer's obligation is to write code that is correct and follows the (tickets) as closely as possible. They are provided (tickets) from the [Lead Developer](#lead-developer). Once the developer is done with the task, they will submit a (pull request) to the [QA](#qa) for review. 

* **Lead Developer** - The lead developer is the person who is responsible for managing the development of the system. The lead developer's perogative is to manage the development of the system, and the lead developer's obligation is to manage the development of the system in a way that is correct and follows the (project goals). They create (tickets) for the [Developer](#developer) to work on. The ticket will contain a description of the task, the expected outcome. It will also contain useful api documentation, design documents, and other information that the developer will need to complete the task. It can also contain a list of API that still need to be implemented. It will specify the language that the [developer](#developer) should use to implement the task. 

* **QA** - The QA is the person who is responsible for testing the new code sent as a (pull request) from the developer. The QA's perogative is to test pull request and make sure it is function in the system, and the QA's obligation is to provide feedback to the developer if they don't believe the (pull request) fulfills the requirements of the (ticket). They will review the pull requests from the [Developer](#developer) and test the code. They will then either approve the (pull request) or (request changes). If the QA requests changes, the [Developer](#developer) will make the changes and submit another pull request. The QA will then review the changes and either approve the pull request or request more changes. This process will continue until the QA approves the (pull request). Once the QA approves the pull request, the [Lead Developer](#lead-developer) will (merge) the (pull request) into the (master branch).

* **System Architect** - The system architect is responsible for designing the system. The system architect's perogative is to design the system, and the system architect's obligation is to design the system in a way that is correct and follows the (project goals). They will create the design documents for the system. They will also create the API documentation for the system. They only communicate with the [Lead Developer](#lead-developer) and the [QA](#qa). They will not communicate with the [Developer](#developer). The system archtect has the final say on the design of the system. The system architect has the ability to (inspect) the system. It can (read files) within the system.

