# Understanding Inductive Bias in Machine Learning: A Guide

## Introduction

**In the machine learning paradigm, the common objective is to generalize over unseen data, i.e. achieving a low error rate over test data "related-to" the training data, is desirable (Mitchel, 1980).**\
 When working with datasets, there can be multiple models that fit the training data well; the challenge is how to select the most appropriate model.

For instance, consider selecting any two points on the Cartesian plane, which uniquely determine a line passing through them. If there are no restrictions on the hypothesis function being linear, an infinite number of higher-order polynomials could pass through those points.\
\
**Inductive Bias** refers to assumptions made 'a priori' about the relationship between inputs and outputs, guiding the selection of one form of generalization over another. The constraints placed on the hypothesis space are termed inductive bias.

![Multiple hypothesis functions showing fit over the datasets: sin function in blue, ridge regression in green, and average in red. Data generated using a sinusoidal function.](/Data/Machine-Learning/inductive_bias_multiple_hypothesis_functions.png)

**Multiple hypothesis functions showing fit over the datasets: sin function in blue, ridge regression in green, and average in red.** <br /> 
**Data generated using a sinusoidal function.**

Researchers have demonstrated that inductive bias imposes limitations on the choice of hypothesis space to be learned, reflecting prior knowledge about the task at hand. This restriction is essential for practical learning to occur. Domain experts, drawing on their prior task knowledge, suggest models that may fit the data well. For example, a biochemist might understand the linear relationship inherent in biological processes and thus propose a linear regression model. Further insights can be gained by delving into the concept of 'Causality'.

## Types

There are two kinds of inductive bias: Strong (Restrictive) and Weak (Preference).

**Strong (Restrictive):** This type involves limiting the search space of hypotheses. For example, when given a dataset and assuming independence of features to classify fruits like apple, banana, and orange, one can reasonably assume independence over features such as weight, shape, and color. This could lead to selecting a suitable hypothesis, e.g., using the naïve Bayes algorithm.

**Weak (Preference):** In this case, a tree model assumes that the relationship between inputs and outputs can be represented as a tree-like structure, thereby imposing an ordering on the hypothesis space (e.g., decision tree).

## Examples

Here is a list of common inductive biases in machine learning algorithms:

- **Occam's Razor:** Preferring simpler functions (f) over complex ones.
- **Principle of Minimum Description Length (Occam's Razor Extension):** Opting for hypotheses that yield the shortest description, including exceptions.
- **Data Locally Connected and Translation Invariant:** Utilized in Convolutional Neural Networks.
- **Maximum Conditional Independence:** A naive independence assumption over feature sets of classes, foundational for the Naive Bayes classifier.
- **Linearity Assumption:** Assuming linear dependence of the output variable on input, leading to models like Linear Regression.
- **Maximum Margin between Support Vectors and Decision Boundary:** Seen in the SVM Classifier.
- **Minimum Cross-Validation Error:** Derived from the "No Free Lunch Theorem," favoring models with minimal cross-validation error for better generalization.
- **Minimum Features:** Selecting significant variance-contributing features; correlated features may be removed.
- **Nearest Neighbors:** KNN, a lazy learning algorithm, identifies 'K' Nearest Neighbors to a query point and classifies the new data point based on similarities.

Inductive biases are also prevalent in Deep Learning, with regularization being an outcome of them. Relational Inductive Biases in Deep Learning involve attention models, which have gained prominence. These models incorporate attention modules to identify long-range relationships between sequential inputs.

## Conclusion

In this blog post, we have explored the concept of inductive bias and its influence on model performance. These assumptions play a pivotal role in a model's ability to generalize from training data to new, unseen data. The interplay between inductive biases, initial knowledge, and the model's generalization capability lies at the core of this matter. Over the years, literature has found these guiding principles—knowledge, biases, and observation—valuable in designing new algorithms. Thus, the domain expertise of human reviewers is as crucial as the data itself in real-world use cases.

**References:**
- [IIT KGP - NPTEL Course: Machine Learning - Sudeshna Sarkar](https://www.youtube.com/watch?v=dYMCwxgl3vk&list=PLIg1dOXc_acbdJo-AE5RXpIM_rvwrerwR&index=3&ab_channel=MachineLearning-SudeshnaSarkar)
- [Prof Mausam's Machine Learning Course Slides (IITD)](https://www.cse.iitd.ac.in/~mausam/courses/csl333/spring2015/lectures/20-mlintro.pdf)
- Battaglia, Peter W., et al. "Relational Inductive Biases, Deep Learning, and Graph Networks." [arXiv preprint arXiv:1806.01261 (2018)](https://arxiv.org/abs/1806.01261)
