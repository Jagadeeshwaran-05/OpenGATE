# GATE Curriculum Static Definitions for CS and DA

# Metadata mapping for the 7 DSAI subjects
DSAI_SUBJECT_META = {
    "probability-and-statistics": {
        "number": "01",
        "short": "Prob-Stats",
        "accent": "#8b5cf6",
        "notebook": "dsai-gate/notebooks/probability/conditional_probability_and_bayes.ipynb"
    },
    "linear-algebra": {
        "number": "02",
        "short": "Linear-Alg",
        "accent": "#06b6d4",
        "notebook": "dsai-gate/notebooks/linear_algebra/projections_and_pca.ipynb"
    },
    "calculus-and-optimization": {
        "number": "03",
        "short": "Calculus-Opt",
        "accent": "#f59e0b",
        "notebook": ""
    },
    "programming-and-algorithms": {
        "number": "04",
        "short": "Prog-Algo",
        "accent": "#22c55e",
        "notebook": ""
    },
    "database-management": {
        "number": "05",
        "short": "DBMS",
        "accent": "#ec4899",
        "notebook": ""
    },
    "machine-learning": {
        "number": "06",
        "short": "ML-Notes",
        "accent": "#3b82f6",
        "notebook": ""
    },
    "AI": {
        "number": "07",
        "short": "AI-Notes",
        "accent": "#ef4444",
        "notebook": ""
    }
}

# Static CS Syllabus definition to ensure completeness
CS_SUBJECTS = [
    {
        "id": "engineering-mathematics",
        "number": "01",
        "short": "Math",
        "title": "Discrete Mathematics & Engg Mathematics",
        "description": "Mathematical logic, sets, relations, functions, graph theory, combinatorics, linear algebra, calculus, and probability.",
        "accent": "#3b82f6",
        "guide": "",
        "notebook": "",
        "topics": [
            "Mathematical Logic: Propositional & First Order Logic",
            "Discrete Mathematics: Sets, Relations, Functions, Partial Orders, Lattices",
            "Groups, Monoids, and Algebraic Structures",
            "Combinatorics: Permutations, Combinations, Generating Functions, Recurrences",
            "Graph Theory: Connectivity, Matching, Coloring",
            "Linear Algebra: Systems of Linear Equations, Eigenvalues, Eigenvectors",
            "Calculus: Limits, Continuity, Differentiability, Maxima, Minima",
            "Probability: Random Variables, Distributions, Mean, Median, Mode"
        ],
        "sections": []
    },
    {
        "id": "digital-logic",
        "number": "02",
        "short": "Digital",
        "title": "Digital Logic",
        "description": "Boolean algebra, logic gates, minimization, combinational and sequential circuits, and computer arithmetic.",
        "accent": "#0d9488",
        "guide": "",
        "notebook": "",
        "topics": [
            "Boolean Algebra and Logic Minimization",
            "Combinational Circuits: Adders, Muxes, Decoders",
            "Sequential Circuits: Latches, Flip-Flops, Registers, Counters",
            "Number Representations and Computer Arithmetic"
        ],
        "sections": []
    },
    {
        "id": "computer-organization",
        "number": "03",
        "short": "COA",
        "title": "Computer Organization & Architecture",
        "description": "Machine instructions, addressing modes, ALU, control unit, instruction pipelining, memory hierarchy, and I/O interface.",
        "accent": "#8b5cf6",
        "guide": "",
        "notebook": "",
        "topics": [
            "Machine Instructions and Addressing Modes",
            "ALU, Data Path, and Control Unit",
            "Instruction Pipelining and Pipelining Hazards",
            "Memory Hierarchy: Cache, Main Memory, Secondary Storage",
            "I/O Interface: Interrupts and DMA Mode"
        ],
        "sections": []
    },
    {
        "id": "programming-and-data-structures",
        "number": "04",
        "short": "Programming",
        "title": "Programming & Data Structures",
        "description": "C programming (pointers, recursion, functions) and core linear/non-linear data structures (stacks, queues, trees, heaps).",
        "accent": "#f97316",
        "guide": "",
        "notebook": "",
        "topics": [
            "Programming in C: Functions, Pointers, Structures",
            "Recursion and Parameter Passing",
            "Linear Data Structures: Arrays, Stacks, Queues, Linked Lists",
            "Non-linear Data Structures: Trees, Binary Search Trees, Binary Heaps",
            "Graph Representation and Traversals"
        ],
        "sections": []
    },
    {
        "id": "algorithms",
        "number": "05",
        "short": "Algorithms",
        "title": "Algorithms",
        "description": "Asymptotic complexity, searching, sorting, hashing, greedy algorithms, dynamic programming, and graph algorithms.",
        "accent": "#10b981",
        "guide": "",
        "notebook": "",
        "topics": [
            "Asymptotic Time and Space Complexity Analysis",
            "Searching and Sorting Algorithms",
            "Hashing and Collision Resolution",
            "Algorithm Design: Divide & Conquer (Mergesort, Quicksort)",
            "Algorithm Design: Greedy and Dynamic Programming",
            "Graph Algorithms: Minimum Spanning Trees (Kruskal, Prim)",
            "Graph Algorithms: Shortest Paths (Dijkstra, Bellman-Ford)"
        ],
        "sections": []
    },
    {
        "id": "theory-of-computation",
        "number": "06",
        "short": "TOC",
        "title": "Theory of Computation",
        "description": "Regular languages, finite automata, context-free grammars, PDA, Turing machines, decidability, and halting problem.",
        "accent": "#ec4899",
        "guide": "",
        "notebook": "",
        "topics": [
            "Regular Expressions and Finite Automata",
            "Context-Free Grammars and Push-Down Automata",
            "Regular and Context-Free Languages",
            "Pumping Lemma and Closure Properties",
            "Turing Machines and Undecidability"
        ],
        "sections": []
    },
    {
        "id": "compiler-design",
        "number": "07",
        "short": "Compiler",
        "title": "Compiler Design",
        "description": "Lexical analysis, parsing algorithms, syntax-directed translation, intermediate code generation, and optimization.",
        "accent": "#f43f5e",
        "guide": "",
        "notebook": "",
        "topics": [
            "Lexical Analysis and Tokenization",
            "Syntax Analysis: Parsing Techniques (LL, LR)",
            "Syntax-Directed Translation and Attribute Grammars",
            "Runtime Environments and Storage Allocation",
            "Intermediate Code Generation",
            "Code Optimization and Liveness Analysis"
        ],
        "sections": []
    },
    {
        "id": "operating-system",
        "number": "08",
        "short": "OS",
        "title": "Operating Systems",
        "description": "Processes, threads, CPU scheduling, concurrency, deadlocks, virtual memory (paging), file systems, and disk scheduling.",
        "accent": "#6366f1",
        "guide": "",
        "notebook": "",
        "topics": [
            "System Calls and OS Structures",
            "Process Management, Threads, and CPU Scheduling",
            "Inter-Process Communication and Concurrency",
            "Semaphores, Mutexes, and Synchronization Problems",
            "Deadlock Detection, Prevention, and Avoidance",
            "Memory Management and Virtual Memory (Paging, Segmentation)",
            "File Systems and Disk Scheduling"
        ],
        "sections": []
    },
    {
        "id": "databases",
        "number": "09",
        "short": "DBMS",
        "title": "Database Management Systems",
        "description": "ER-model, relational algebra, SQL, integrity constraints, normalization (BCNF), file indexing, transactions, and serializability.",
        "accent": "#e11d48",
        "guide": "",
        "notebook": "",
        "topics": [
            "ER-Model and Schema Design",
            "Relational Model: Relational Algebra, Tuple Calculus",
            "SQL: Queries, Triggers, Views, Constraints",
            "Database Normalization (1NF, 2NF, 3NF, BCNF)",
            "File Organization and Indexing (B and B+ Trees)",
            "Transaction Management: Concurrency Control and Serializability"
        ],
        "sections": []
    },
    {
        "id": "computer-networks",
        "number": "10",
        "short": "Networks",
        "title": "Computer Networks",
        "description": "OSI/TCP-IP stacks, switching, routing algorithms, IPv4/IPv6, transport layers (TCP congestion control), and application protocols.",
        "accent": "#2563eb",
        "guide": "",
        "notebook": "",
        "topics": [
            "Concept of Layering: OSI and TCP/IP protocol stacks",
            "Switching: Packet, Circuit, and Virtual Circuit-Switching",
            "Data Link Layer: Framing, Error Detection/Correction, Flow Control",
            "Medium Access Control and Ethernet Bridging",
            "Routing Protocols: Shortest Path, Distance Vector, Link State Routing",
            "Network Layer: Fragmentation, IP addressing (IPv4, IPv6), CIDR",
            "Transport Layer: UDP, TCP, Congestion Control, Sockets",
            "Application Layer Protocols: DNS, SMTP, POP, FTP, HTTP, HTTPS"
        ],
        "sections": []
    }
]
